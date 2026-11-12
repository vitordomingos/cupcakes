import '../styles/globals.css';
import Head from 'next/head';
import { CartProvider } from '../src/context/CartContext';
import { SessionProvider } from '../src/context/SessionContext';
import Header from '../src/components/Header';

export default function App({ Component, pageProps }) {
  return (
    <SessionProvider>
      <CartProvider>
        <Head>
          <title>Cupcakes Gourmet</title>
        </Head>
        <Header />
        <main>
          <Component {...pageProps} />
        </main>
      </CartProvider>
    </SessionProvider>
  );
}
