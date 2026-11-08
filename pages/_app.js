import '../styles/globals.css';
import Head from 'next/head';
import { CartProvider } from '../src/context/CartContext';
import Header from '../src/components/Header';

export default function App({ Component, pageProps }) {
  return (
    <CartProvider>
      <Head>
        <title>Cupcakes Gourmet</title>
      </Head>
      <Header />
      <main>
        <Component {...pageProps} />
      </main>
    </CartProvider>
  );
}

