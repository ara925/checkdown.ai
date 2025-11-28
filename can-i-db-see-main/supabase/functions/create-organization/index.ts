import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const createOrgSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  name: z.string().trim().min(1, 'Name is required').max(200, 'Name too long'),
  email: z.string().email('Invalid email address'),
  organizationName: z.string().trim().min(1, 'Organization name is required').max(200, 'Organization name too long'),
});

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
    
    const validationResult = createOrgSchema.safeParse(rawBody);
    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid input', details: validationResult.error.errors[0].message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { userId, name, email, organizationName } = validationResult.data;

    console.log('Creating organization for user:', { userId, name, email, organizationName });

    // Check if user already has a profile
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (existingUser?.organization_id) {
      return new Response(
        JSON.stringify({ error: 'You are already part of an organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if organization name already exists
    const { data: existingOrg } = await supabase
      .from('organizations')
      .select('id')
      .eq('name', organizationName)
      .maybeSingle();

    if (existingOrg) {
      return new Response(
        JSON.stringify({ error: 'Organization name already exists. Please choose a different name.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create organization
    const { data: organization, error: orgError } = await supabase
      .from('organizations')
      .insert([{ name: organizationName }])
      .select()
      .single();

    if (orgError) throw orgError;

    // Create team for organization
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert([{
        name: `${organizationName} Team`,
        organization_id: organization.id
      }])
      .select()
      .single();

    if (teamError) throw teamError;

    // Update or create user profile
    let user;
    if (existingUser) {
      // Update existing user record
      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update({
          name,
          organization_id: organization.id,
          role: 'owner'
        })
        .eq('id', existingUser.id)
        .select()
        .single();

      if (updateError) throw updateError;
      user = updatedUser;
    } else {
      // Create new user profile (shouldn't happen with trigger, but fallback)
      const { data: newUser, error: userError } = await supabase
        .from('users')
        .insert([{
          auth_user_id: userId,
          email,
          name,
          organization_id: organization.id,
          role: 'owner',
          password_hash: 'managed_by_supabase_auth'
        }])
        .select()
        .single();

      if (userError) throw userError;
      user = newUser;
    }

    // Add user to team
    const { error: teamMemberError } = await supabase
      .from('team_members')
      .insert([{
        user_id: user.id,
        team_id: team.id,
        role: 'owner'
      }]);

    if (teamMemberError) throw teamMemberError;

    // Create user role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert([{
        user_id: user.id,
        organization_id: organization.id,
        role: 'owner'
      }]);

    if (roleError) throw roleError;

    console.log('Organization and user setup completed successfully');

    return new Response(
      JSON.stringify({ success: true, organization, user }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in create-organization:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
