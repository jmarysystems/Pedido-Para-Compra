# Pedido de Compra

Sistema separado da JMarySystems, no mesmo padrão dos demais.

Lista os pedidos de compra gerados na Cotação, com itens, recebimento,
nota fiscal e impressão.

## Banco

- `pedidos_gerados` e `pedido_itens` (as mesmas tabelas usadas pela Cotação).

## Permissões

Respeita o módulo `pedido` do Controle de Acesso — inclusive nas políticas do banco.

## Rodar localmente

```bash
python -m http.server 5500
```
