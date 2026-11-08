-- Schema da Loja de Cupcakes Gourmet (PostgreSQL)
-- Idempotente: pode ser executado várias vezes.

CREATE TABLE IF NOT EXISTS cliente (
  id_cliente  SERIAL PRIMARY KEY,
  nome        VARCHAR(120) NOT NULL,
  telefone    VARCHAR(30)  NOT NULL,
  usuario     VARCHAR(60)  NOT NULL UNIQUE,
  senha       VARCHAR(255) NOT NULL,
  endereco    VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS produto (
  id_produto         SERIAL PRIMARY KEY,
  nome               VARCHAR(120)  NOT NULL,
  descricao          TEXT          NOT NULL DEFAULT '',
  preco              NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
  quantidade_estoque INTEGER       NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pedido (
  id_pedido       SERIAL PRIMARY KEY,
  id_cliente      INTEGER       NOT NULL REFERENCES cliente(id_cliente),
  data_hora       TIMESTAMP     NOT NULL DEFAULT NOW(),
  status          VARCHAR(30)   NOT NULL DEFAULT 'Recebido'
                  CHECK (status IN ('Recebido','Em Preparo','Saiu para Entrega','Finalizado')),
  forma_pagamento VARCHAR(30)   NOT NULL
                  CHECK (forma_pagamento IN ('Pix na entrega','Cartão na entrega')),
  valor_total     NUMERIC(10,2) NOT NULL,
  taxa_entrega    NUMERIC(10,2) NOT NULL
);

CREATE TABLE IF NOT EXISTS item_pedido (
  id_item        SERIAL PRIMARY KEY,
  id_pedido      INTEGER       NOT NULL REFERENCES pedido(id_pedido) ON DELETE CASCADE,
  id_produto     INTEGER       NOT NULL REFERENCES produto(id_produto),
  quantidade     INTEGER       NOT NULL CHECK (quantidade > 0),
  preco_unitario NUMERIC(10,2) NOT NULL,
  subtotal       NUMERIC(10,2) NOT NULL
);

-- Seed de produtos (somente se a tabela estiver vazia)
INSERT INTO produto (nome, descricao, preco, quantidade_estoque)
SELECT * FROM (VALUES
  ('Red Velvet', 'Massa aveludada com cobertura de cream cheese.', 12.90, 20),
  ('Chocolate Belga', 'Chocolate 70% cacau com ganache cremosa.', 13.50, 15),
  ('Limão Siciliano', 'Massa cítrica com merengue maçaricado.', 11.90, 10),
  ('Doce de Leite', 'Recheio de doce de leite artesanal.', 12.50, 0),
  ('Frutas Vermelhas', 'Chantilly com geleia de frutas vermelhas.', 14.00, 8),
  ('Pistache', 'Creme de pistache com pedaços crocantes.', 15.90, 0)
) AS v(nome, descricao, preco, quantidade_estoque)
WHERE NOT EXISTS (SELECT 1 FROM produto);

