import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bcrypt from 'https://esm.sh/bcryptjs@2.4.3';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const signInSchema = z.object({
  email: z.string().email('Invalid email format').max(255, 'Email too long'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long')
});

async function createJWT(payload: any, secret: string): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const headerB64 = btoa(JSON.stringify(header));
  const payloadB64 = btoa(JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 }));
  
  const message = `${headerB64}.${payloadB64}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${message}.${signatureB64}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const rawBody = await req.json();
    
    const validationResult = signInSchema.safeParse(rawBody);
    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validationResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { email, password } = validationResult.data;
    const sanitizedEmail = email.trim().toLowerCase();

    console.log('Sign in attempt for:', sanitizedEmail);

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('email', sanitizedEmail)
      .is('deleted_at', null)
      .maybeSingle();

    if (userError) {
      console.error('Database error:', userError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!user) {
      console.log('User not found:', email);
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password using bcryptjs
    const passwordMatch = bcrypt.compareSync(password, user.password_hash);
    
    if (!passwordMatch) {
      console.log('Password mismatch for user:', email);
      return new Response(
        JSON.stringify({ error: 'Invalid email or password' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Password verified for user:', email);

    // Get user's team
    const { data: teamMember } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id)
      .maybeSingle();

    // Create JWT
    const authSecret = Deno.env.get('AUTH_SECRET') || 'default-secret-change-in-production';
    const token = await createJWT({
      userId: user.id,
      email: user.email,
      role: user.role,
      organizationId: user.organization_id,
      departmentId: user.department_id,
      teamId: teamMember?.team_id || null,
    }, authSecret);

    // Log activity
    if (teamMember) {
      await supabase.from('activity_logs').insert({
        team_id: teamMember.team_id,
        user_id: user.id,
        organization_id: user.organization_id,
        action: 'user.sign_in',
      });
    }

    console.log('Sign in successful for:', email);

    return new Response(
      JSON.stringify({ 
        success: true,
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          organization_id: user.organization_id,
          department_id: user.department_id,
          team_id: teamMember?.team_id || null,
        }
      }),
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Set-Cookie': `auth-token=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${7 * 24 * 60 * 60}`
        } 
      }
    );
  } catch (error: any) {
    console.error('Sign in error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
