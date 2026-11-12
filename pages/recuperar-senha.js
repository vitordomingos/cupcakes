import Link from 'next/link';
import { useRouter } from 'next/router';
import RecuperarSenhaForm from '../src/components/RecuperarSenhaForm';

export default function RecuperarSenha() {
  const router = useRouter();
  return (
    <>
      <h1>Esqueci minha senha</h1>
      <RecuperarSenhaForm onConcluido={() => router.push('/login?senha=redefinida')} />
      <p><Link href="/login">Voltar ao login</Link></p>
    </>
  );
}

