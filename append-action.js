const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'web/src/app/dashboard/actions.ts');
const code = `

// ── تعديل الموظفين ──────────────────────────────────────────────
export async function updateStaffProfileAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) redirect('/login');

  const { data: profile } = await supabase
    .from('app_users')
    .select('role')
    .eq('auth_user_id', session.user.id)
    .maybeSingle();

  if (!getRoleCapabilities(profile?.role).isGeneralManager) {
    return { error: 'ليس لديك صلاحية المدير العام لتعديل الموظفين.' };
  }

  const staff_id = formData.get('staff_id')?.toString();
  const role = formData.get('role')?.toString();
  const branch_id = formData.get('branch_id')?.toString() || null;
  const is_active = formData.get('is_active') === 'on';

  if (!staff_id || !role) {
    return { error: 'بيانات الموظف غير مكتملة.' };
  }

  const admin = getServiceRoleClient();
  const { error } = await admin
    .from('app_users')
    .update({
      role,
      branch_id,
      is_active,
      status: is_active ? 'active' : 'inactive',
    })
    .eq('id', staff_id);

  if (error) {
    return { error: 'حدث خطأ أثناء حفظ بيانات الموظف: ' + error.message };
  }

  revalidatePath('/dashboard/staff');
  return { success: true };
}
`;

fs.appendFileSync(file, code);
console.log('Appended to actions.ts successfully.');
