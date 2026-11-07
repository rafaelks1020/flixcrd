/**
 * Acesso ao LAB.
 * Decisão do dono: todo usuário logado acessa o LAB, sem trava de plano.
 * A sessão é exigida pelas rotas e páginas; aqui basta haver usuário.
 */
export async function hasLabAccess(userId: string, _userRole?: string): Promise<boolean> {
  return Boolean(userId);
}
