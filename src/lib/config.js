export const TAXA_ENTREGA = 8.0;

export const STATUS = ['Recebido', 'Em Preparo', 'Saiu para Entrega', 'Finalizado'];

export const FORMAS_PAGAMENTO = [
  { valor: 'Cartão na entrega', rotulo: 'Cartão (Maquininha na entrega)' },
  { valor: 'Pix na entrega', rotulo: 'PIX (Transferência na entrega)' },
];

export const proximoStatus = (atual) => {
  const i = STATUS.indexOf(atual);
  return i >= 0 && i < STATUS.length - 1 ? STATUS[i + 1] : null;
};

export const formatBRL = (v) =>
  Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

