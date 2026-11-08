import { ADMIN_COOKIE, adminToken } from '../lib/auth';
import { HttpError, handleError, methodNotAllowed } from '../lib/http';

// POST /api/admin/login  { senha } | DELETE /api/admin/login (logout)
export async function loginHandler(req, res) {
  try {
    if (req.method === 'POST') {
      const senha = req.body?.senha;
      if (!senha || senha !== (process.env.ADMIN_PASSWORD || 'admin123')) {
        throw new HttpError(401, 'Senha de administrador incorreta.');
      }
      res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=${adminToken()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`);
      return res.status(200).json({ ok: true });
    }
    if (req.method === 'DELETE') {
      res.setHeader('Set-Cookie', `${ADMIN_COOKIE}=; Path=/; HttpOnly; Max-Age=0`);
      return res.status(200).json({ ok: true });
    }
    return methodNotAllowed(res, ['POST', 'DELETE']);
  } catch (err) {
    return handleError(res, err);
  }
}

