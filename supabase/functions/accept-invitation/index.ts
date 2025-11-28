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

    const { userId, invitationId, name, email } = await req.json();

    const authHeader = req.headers.get('Authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const { data: authUser, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !authUser?.user || authUser.user.id !== userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    console.log('Accepting invitation:', { userId, invitationId, name, email });

    // Get invitation details
    const { data: invitation, error: inviteError } = await supabase
      .from('invitations')
      .select('*, teams!inner(organization_id)')
      .eq('id', invitationId)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invitation) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired invitation' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'User already has an account' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const organizationId = invitation.teams.organization_id;

    // Create user profile
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert([{
        auth_user_id: userId,
        email,
        name,
        organization_id: organizationId,
        role: invitation.role,
        password_hash: 'managed_by_supabase_auth'
      }])
      .select()
      .single();

    if (userError) throw userError;

    // Add user to team
    const { error: teamMemberError } = await supabase
      .from('team_members')
      .insert([{
        user_id: user.id,
        team_id: invitation.team_id,
        role: invitation.role
      }]);

    if (teamMemberError) throw teamMemberError;

    // Create user role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert([{
        user_id: user.id,
        organization_id: organizationId,
        role: invitation.role
      }]);

    if (roleError) throw roleError;

    // Update invitation status
    await supabase
      .from('invitations')
      .update({ status: 'accepted' })
      .eq('id', invitationId);

    console.log('Invitation accepted successfully');

    return new Response(
      JSON.stringify({ success: true, user }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in accept-invitation:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
