// Pedidos de compra: lista, itens, recebimento/NF e impressão.
import { listar, atualizar } from '../api.js';
import * as ui from '../ui.js';

const BADGE = {
  gerado: 'Gerado', enviado: 'Enviado', recebido: 'Recebido', cancelado: 'Cancelado',
};

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export async function render(raiz, ctx) {
  ctx.setTitulo('Pedido de Compra');

  const podeEditar = ctx.pode('pedido', 'editar');
  const pedidos = await listar('pedidos_gerados', {
    select: '*, fornecedores(razao_social), pedido_itens(*)',
    ordem: 'numero',
    asc: false,
  });

  raiz.innerHTML = `
    <div class="cartao">
      <div class="cartao-topo"><h2>${pedidos.length} pedido(s) de compra</h2></div>
      <p class="sub">Abra os itens, registre o recebimento e a nota fiscal, e imprima o pedido.</p>
    </div>
    <div id="lista"></div>`;

  const lista = raiz.querySelector('#lista');

  function cartao(p) {
    const itens = p.pedido_itens || [];
    const fornecedor = p.fornecedores?.razao_social || '—';
    return `
      <div class="cartao">
        <div class="cartao-topo">
          <div>
            <h2 style="display:flex;align-items:center;gap:10px">
              ${ui.esc(p.numero)}
              <span class="badge">${ui.esc(BADGE[p.status] || p.status || '—')}</span>
              <span class="badge ${p.recebido ? 'badge-ok' : 'badge-neutro'}">
                ${p.recebido ? 'recebido' : 'não recebido'}</span>
            </h2>
            <p class="sub" style="margin:6px 0 0">
              ${ui.esc(fornecedor)} · ${ui.dataBR(p.data_pedido)} · ${itens.length} item(ns) ·
              total <strong>${brl(p.valor_total)}</strong> ·
              ${p.nota_fiscal ? `NF ${ui.esc(p.nota_fiscal)}` : 'sem nota fiscal'}
              ${p.enviado_em ? ` · enviado em ${ui.dataHoraBR(p.enviado_em)}` : ''}
            </p>
          </div>
          <div class="linha-acoes">
            <button type="button" class="botao-pequeno" data-itens="${ui.esc(p.id)}">Itens</button>
            ${podeEditar ? `<button type="button" class="botao-pequeno" data-receber="${ui.esc(p.id)}">Recebimento / NF</button>` : ''}
            <button type="button" class="botao-pequeno" data-imprimir="${ui.esc(p.id)}">Imprimir</button>
          </div>
        </div>
      </div>`;
  }

  function desenhar() {
    lista.innerHTML = pedidos.length
      ? pedidos.map(cartao).join('')
      : ui.vazio('Nenhum pedido de compra gerado.');
    ligar();
  }

  function ligar() {
    for (const b of lista.querySelectorAll('[data-itens]')) {
      b.addEventListener('click', () => modalItens(pedidos.find((p) => p.id === b.dataset.itens)));
    }
    for (const b of lista.querySelectorAll('[data-receber]')) {
      b.addEventListener('click', () => modalRecebimento(pedidos.find((p) => p.id === b.dataset.receber)));
    }
    for (const b of lista.querySelectorAll('[data-imprimir]')) {
      b.addEventListener('click', () => imprimir(pedidos.find((p) => p.id === b.dataset.imprimir)));
    }
  }

  function modalItens(p) {
    const itens = p.pedido_itens || [];
    ui.modal({
      titulo: `Itens — ${p.numero}`,
      largura: '760px',
      corpo: itens.length ? `
        <div class="tabela-rolagem"><table>
          <thead><tr><th>SKU</th><th>Descrição</th><th class="num">Qtd</th><th>Un.</th>
            <th class="num">Custo</th><th class="num">Total</th></tr></thead>
          <tbody>
            ${itens.map((i) => `<tr>
              <td class="mono">${ui.esc(i.sku || '')}</td>
              <td>${ui.esc(i.descricao)}</td>
              <td class="num">${num(i.quantidade)}</td>
              <td>${ui.esc(i.unidade || '')}</td>
              <td class="num">${brl(i.valor_de_custo_do_fornecedor)}</td>
              <td class="num">${brl(i.valor_total)}</td>
            </tr>`).join('')}
          </tbody>
          <tfoot><tr><th colspan="5">Total</th><th class="num">${brl(p.valor_total)}</th></tr></tfoot>
        </table></div>` : ui.vazio('Pedido sem itens.'),
    });
  }

  function modalRecebimento(p) {
    const { fechar, corpo } = ui.modal({
      titulo: `Recebimento / NF — ${p.numero}`,
      corpo: `
        <label class="campo"><span>Situação</span>
          <select name="recebido">
            <option value="nao" ${p.recebido ? '' : 'selected'}>Não recebido</option>
            <option value="sim" ${p.recebido ? 'selected' : ''}>Recebido</option>
          </select></label>
        ${ui.campoTexto('Nota fiscal', 'nota_fiscal', p.nota_fiscal || '', { placeholder: 'número da NF' })}
        <div class="linha-acoes">
          <button type="button" class="botao-primario" id="salvar">Salvar</button>
          <button type="button" id="cancelar">Cancelar</button>
        </div>`,
    });

    corpo.querySelector('#cancelar').addEventListener('click', fechar);
    corpo.querySelector('#salvar').addEventListener('click', async () => {
      const recebido = corpo.querySelector('[name="recebido"]').value === 'sim';
      const nota = corpo.querySelector('[name="nota_fiscal"]').value.trim();
      try {
        await atualizar('pedidos_gerados', p.id, {
          recebido,
          recebido_em: recebido ? new Date().toISOString() : null,
          nota_fiscal: nota || null,
          nota_fiscal_em: nota ? new Date().toISOString() : null,
        });
        fechar();
        ui.toast('Pedido atualizado.');
        ctx.recarregar();
      } catch (erro) { ui.toast(erro.message, 'erro'); }
    });
  }

  function imprimir(p) {
    const itens = p.pedido_itens || [];
    document.querySelectorAll('.area-impressao').forEach((n) => n.remove());
    const el = document.createElement('div');
    el.className = 'area-impressao';
    el.innerHTML = `
      <div class="print-cabecalho">
        <div class="titulo">
          <h1>Pedido de Compra</h1>
          <h2>${ui.esc(p.numero)}</h2>
        </div>
      </div>
      <p class="print-periodo">
        ${ui.esc(p.fornecedores?.razao_social || '')} · ${ui.dataBR(p.data_pedido)}
      </p>
      <table>
        <thead><tr><th>SKU</th><th>Descrição</th><th>Qtd</th><th>Un.</th>
          <th>Custo</th><th>Total</th></tr></thead>
        <tbody>
          ${itens.map((i) => `<tr>
            <td>${ui.esc(i.sku || '')}</td>
            <td>${ui.esc(i.descricao)}</td>
            <td>${num(i.quantidade)}</td>
            <td>${ui.esc(i.unidade || '')}</td>
            <td>${brl(i.valor_de_custo_do_fornecedor)}</td>
            <td>${brl(i.valor_total)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <p style="text-align:right;font-weight:700;margin-top:10px">Total: ${brl(p.valor_total)}</p>
      <div class="print-assinaturas">
        <div>Assinatura/Comprador</div>
        <div>Assinatura/Fornecedor</div>
      </div>`;
    document.body.appendChild(el);
    window.addEventListener('afterprint', () => el.remove(), { once: true });
    window.print();
  }

  desenhar();
}
