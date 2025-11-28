import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { email, role, organizationId } = await req.json();

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const { data: authUser, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: caller } = await supabase
      .from('users')
      .select('id, organization_id')
      .eq('auth_user_id', authUser.user.id)
      .maybeSingle();
    if (!caller) {
      return new Response(JSON.stringify({ error: 'Caller not found' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: callerRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('organization_id', organizationId)
      .maybeSingle();
    if (!callerRole || (callerRole.role !== 'owner' && callerRole.role !== 'admin')) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Inviting member:', { email, role, organizationId, invitedBy: caller.id });

    // Check if user already exists in the organization
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, auth_user_id')
      .eq('email', email)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'User already exists in this organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get the team for this organization
    const { data: team } = await supabase
      .from('teams')
      .select('id')
      .eq('organization_id', organizationId)
      .limit(1)
      .single();

    if (!team) {
      return new Response(
        JSON.stringify({ error: 'No team found for organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create invitation record with a unique token
    const invitationToken = crypto.randomUUID();
    
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .insert([{
        email,
        role,
        team_id: team.id,
        invited_by: caller.id,
        status: 'pending',
        token: invitationToken
      }])
      .select()
      .single();

    if (inviteError) throw inviteError;

    // Get organization name
    const { data: org } = await supabase
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();

    console.log('Invitation created successfully:', { invitationId: invitation.id, token: invitationToken });

    // Send invitation email through Supabase Auth
    const invitationLink = `https://checkdown.ai/accept-invitation?token=${invitationToken}`;
    
    const { data: inviteData, error: inviteEmailError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo: invitationLink,
      data: {
        organization_name: org?.name || 'the organization',
        invitation_token: invitationToken
      }
    });

    if (inviteEmailError) {
      console.error('Error sending invitation email:', inviteEmailError);
      // Don't fail the whole operation if email fails, just log it
    } else {
      console.log('Invitation email sent successfully to:', email);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        invitation,
        invitationLink,
        emailSent: !inviteEmailError
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in invite-member:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
