// Dashboard dos pedidos de compra.
import { rpc } from '../api.js?v=20261119a';
import * as ui from '../ui.js?v=20261119a';

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function barra(valor, maximo) {
  const pct = maximo > 0 ? Math.max(2, Math.round((valor / maximo) * 100)) : 0;
  return `<div class="barra"><div style="width:${pct}%"></div></div>`;
}

export async function render(raiz, ctx) {
  ctx.setTitulo('Dashboard');

  const d = await rpc('pedido_dashboard');
  const { totais, por_estabelecimento: est, por_fornecedor: forn, por_categoria: cat } = d;

  const maxEst = Math.max(...est.map((x) => x.pedidos), 1);
  const maxForn = Math.max(...forn.map((x) => x.pedidos), 1);
  const maxCat = Math.max(...cat.map((x) => x.itens), 1);

  raiz.innerHTML = `
    <div class="kpis">
      <div class="kpi">
        <div class="rotulo">Pedidos realizados</div>
        <div class="valor">${ui.num(totais.pedidos)}</div>
        <div class="detalhe">pedidos de compra gerados</div>
      </div>
      <div class="kpi">
        <div class="rotulo">Pedidos recebidos</div>
        <div class="valor">${ui.num(totais.recebidos)}</div>
        <div class="detalhe">marcados como recebidos</div>
      </div>
      <div class="kpi">
        <div class="rotulo">% recebidos</div>
        <div class="valor" style="color:var(--verde)">${ui.pct(totais.percentual)}</div>
        <div class="detalhe">recebidos ÷ realizados</div>
      </div>
      <div class="kpi">
        <div class="rotulo">Valor total</div>
        <div class="valor">${brl(totais.valor)}</div>
        <div class="detalhe">soma dos pedidos</div>
      </div>
    </div>

    <div class="cartao">
      <h2>Resultado por estabelecimento</h2>
      ${est.length ? `<div class="tabela-rolagem"><table>
        <thead><tr><th>Estabelecimento</th><th class="num">Pedidos</th>
          <th class="num">Recebidos</th><th class="num">%</th><th class="num">Valor</th><th></th></tr></thead>
        <tbody>
          ${est.map((x) => `<tr>
            <td>${ui.esc(x.nome)}</td>
            <td class="num">${ui.num(x.pedidos)}</td>
            <td class="num">${ui.num(x.recebidos)}</td>
            <td class="num">${ui.pct(x.percentual)}</td>
            <td class="num">${brl(x.valor)}</td>
            <td style="width:170px">${barra(x.pedidos, maxEst)}</td>
          </tr>`).join('')}
        </tbody>
        <tfoot><tr>
          <th>Total</th><th class="num">${ui.num(totais.pedidos)}</th>
          <th class="num">${ui.num(totais.recebidos)}</th>
          <th class="num">${ui.pct(totais.percentual)}</th>
          <th class="num">${brl(totais.valor)}</th><th></th>
        </tr></tfoot>
      </table></div>` : ui.vazio('Nenhum pedido registrado ainda.')}
    </div>

    <div class="cartao">
      <h2>Resultado por fornecedor</h2>
      ${forn.length ? `<div class="tabela-rolagem"><table>
        <thead><tr><th>Fornecedor</th><th class="num">Pedidos</th>
          <th class="num">Recebidos</th><th class="num">%</th><th class="num">Valor</th><th></th></tr></thead>
        <tbody>
          ${forn.map((x) => `<tr>
            <td>${ui.esc(x.nome)}</td>
            <td class="num">${ui.num(x.pedidos)}</td>
            <td class="num">${ui.num(x.recebidos)}</td>
            <td class="num">${ui.pct(x.percentual)}</td>
            <td class="num">${brl(x.valor)}</td>
            <td style="width:170px">${barra(x.pedidos, maxForn)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>` : ui.vazio('Nenhum pedido registrado ainda.')}
    </div>

    <div class="cartao">
      <h2>Resultado por categoria</h2>
      ${cat.length ? `<div class="tabela-rolagem"><table>
        <thead><tr><th>Categoria</th><th class="num">Pedidos</th>
          <th class="num">Itens</th><th class="num">Valor</th><th></th></tr></thead>
        <tbody>
          ${cat.map((x) => `<tr>
            <td>${ui.esc(x.nome)}</td>
            <td class="num">${ui.num(x.pedidos)}</td>
            <td class="num">${ui.num(x.itens)}</td>
            <td class="num">${brl(x.valor)}</td>
            <td style="width:170px">${barra(x.itens, maxCat)}</td>
          </tr>`).join('')}
        </tbody>
      </table></div>` : ui.vazio('Nenhum item de pedido ainda.')}
    </div>`;
}
