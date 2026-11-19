// Pedidos de compra: lista, busca, itens, recebimento/NF, edição, exclusão e impressão.
import { sb, listar, atualizar, excluir } from '../api.js';
import * as ui from '../ui.js';

const BADGE = {
  gerado: 'Gerado', enviado: 'Enviado', recebido: 'Recebido', cancelado: 'Cancelado',
};

const SITUACOES = ['gerado', 'enviado', 'recebido', 'cancelado'];

const brl = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const num = (v) => Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 3 });

export async function render(raiz, ctx) {
  ctx.setTitulo('Pedido de Compra');

  const podeEditar = ctx.pode('pedido', 'editar');
  const podeExcluir = ctx.pode('pedido', 'excluir');

  const pedidos = await listar('pedidos_gerados', {
    select: '*, fornecedores(razao_social), pedido_itens(*)',
    ordem: 'numero',
    asc: false,
  });

  let selecionado = null;

  raiz.innerHTML = `
    <div class="cartao">
      <div class="cartao-topo"><h2>${pedidos.length} pedido(s) de compra</h2></div>
      <p class="sub">Abra os itens, registre o recebimento e a nota fiscal, edite, exclua ou imprima o pedido.</p>
      <label class="campo" style="max-width:420px"><span>Pesquisar</span>
        <input type="search" id="busca" placeholder="Número do pedido ou fornecedor"></label>
    </div>

    <div id="barra-selecao" class="cartao" hidden
         style="padding:12px 16px;background:#eef3fb;border-color:#cfe0f6">
      <div class="linha-acoes">
        <strong id="selecionado-info"></strong>
        ${podeEditar ? '<button type="button" class="botao-pequeno" id="editar">Editar</button>' : ''}
        ${podeExcluir ? '<button type="button" class="botao-pequeno botao-perigo" id="excluir">Excluir</button>' : ''}
        <button type="button" class="botao-pequeno" id="cancelar-selecao">Cancelar</button>
      </div>
    </div>

    <div id="lista"></div>`;

  const lista = raiz.querySelector('#lista');
  const barra = raiz.querySelector('#barra-selecao');
  const busca = raiz.querySelector('#busca');

  function atualizarBarra() {
    barra.hidden = !selecionado;
    if (selecionado) {
      raiz.querySelector('#selecionado-info').textContent =
        `Selecionado: ${selecionado.numero} — ${selecionado.fornecedores?.razao_social || '—'}`;
    }
  }

  function cartao(p) {
    const itens = p.pedido_itens || [];
    const fornecedor = p.fornecedores?.razao_social || '—';
    const marcado = selecionado && selecionado.id === p.id;

    return `
      <div class="cartao" data-id="${ui.esc(p.id)}" data-busca="${ui.esc(`${p.numero} ${fornecedor}`.toLowerCase())}"
           style="${marcado ? 'border-color:#2f7fd1;box-shadow:0 0 0 1px #2f7fd1 inset' : ''}">
        <div class="cartao-topo">
          <div class="linha-acoes" style="align-items:flex-start">
            <input type="radio" name="sel" data-sel="${ui.esc(p.id)}" ${marcado ? 'checked' : ''}
                   style="margin-top:6px;width:18px;height:18px;cursor:pointer">
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
    const termo = busca.value.trim().toLowerCase();
    const visiveis = pedidos.filter((p) => !termo
      || `${p.numero} ${p.fornecedores?.razao_social || ''}`.toLowerCase().includes(termo));

    lista.innerHTML = visiveis.length
      ? visiveis.map(cartao).join('')
      : ui.vazio(termo ? 'Nenhum pedido encontrado.' : 'Nenhum pedido de compra gerado.');
    ligar();
    atualizarBarra();
  }

  function ligar() {
    for (const r of lista.querySelectorAll('[data-sel]')) {
      r.addEventListener('change', () => {
        selecionado = pedidos.find((p) => p.id === r.dataset.sel) || null;
        desenhar();
      });
    }
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

  busca.addEventListener('input', desenhar);

  // ------------------------------------------------------------- editar
  function modalEditar(p) {
    const itens = (p.pedido_itens || []).map((i) => ({ ...i }));
    const removidos = [];

    const { fechar, corpo } = ui.modal({
      titulo: `Editar pedido — ${p.numero}`,
      largura: '960px',
      corpo: `
        <form id="form" class="grade grade-2">
          ${ui.campoTexto('Número', 'numero', p.numero, { obrigatorio: true })}
          ${ui.campoSelect('Situação', 'status',
            SITUACOES.map((s) => ({ valor: s, rotulo: BADGE[s] })), p.status || 'gerado')}
          ${ui.campoTexto('Data do pedido', 'data_pedido', p.data_pedido || '', { tipo: 'date' })}
          ${ui.campoTexto('Nota fiscal', 'nota_fiscal', p.nota_fiscal || '')}
          <label class="campo"><span>Recebido</span>
            <input type="checkbox" name="recebido" ${p.recebido ? 'checked' : ''}></label>
          <label class="campo"><span>Observação</span>
            <input name="observacao" value="${ui.esc(p.observacao || '')}"></label>

          <div class="campo-largo" style="margin-top:6px">
            <div class="cartao-topo" style="margin-bottom:8px">
              <strong>Itens do pedido</strong>
              <button type="button" class="botao-pequeno" id="add-item">Adicionar item</button>
            </div>
            <div class="tabela-rolagem"><table id="tabela-itens">
              <thead><tr><th>SKU</th><th>Descrição</th><th>Qtd</th><th>Un.</th>
                <th>Custo</th><th class="num">Total</th><th></th></tr></thead>
              <tbody></tbody>
              <tfoot><tr><th colspan="5">Total do pedido</th>
                <th class="num" id="total-itens">—</th><th></th></tr></tfoot>
            </table></div>
          </div>

          <div class="linha-acoes campo-largo">
            <button type="submit" class="botao-primario">Salvar</button>
            <button type="button" id="cancelar">Cancelar</button>
          </div>
        </form>`,
    });

    const tbody = corpo.querySelector('#tabela-itens tbody');
    const totalEl = corpo.querySelector('#total-itens');

    function recalcular() {
      let total = 0;
      for (const i of itens) {
        const qtd = Number(i.quantidade) || 0;
        const custo = Number(i.valor_de_custo_do_fornecedor) || 0;
        i.valor_total = Math.round(qtd * custo * 100) / 100;
        total += i.valor_total;
      }
      totalEl.textContent = brl(total);
    }

    function desenharItens() {
      tbody.innerHTML = itens.map((i, idx) => `
        <tr data-i="${idx}">
          <td><input data-campo="sku" value="${ui.esc(i.sku || '')}" style="width:110px"></td>
          <td><input data-campo="descricao" value="${ui.esc(i.descricao || '')}"></td>
          <td><input data-campo="quantidade" type="number" step="0.001"
                     value="${i.quantidade ?? ''}" style="width:90px"></td>
          <td><input data-campo="unidade" value="${ui.esc(i.unidade || '')}" style="width:70px"></td>
          <td><input data-campo="valor_de_custo_do_fornecedor" type="number" step="0.01"
                     value="${i.valor_de_custo_do_fornecedor ?? ''}" style="width:110px"></td>
          <td class="num">${brl(i.valor_total)}</td>
          <td><button type="button" class="botao-pequeno botao-perigo"
                     data-remover-item="${idx}">×</button></td>
        </tr>`).join('') || '<tr><td colspan="7">Pedido sem itens.</td></tr>';

      for (const input of tbody.querySelectorAll('[data-campo]')) {
        input.addEventListener('input', () => {
          const idx = Number(input.closest('tr').dataset.i);
          const campo = input.dataset.campo;
          itens[idx][campo] = campo === 'quantidade' || campo === 'valor_de_custo_do_fornecedor'
            ? (input.value === '' ? null : Number(input.value))
            : input.value;
          recalcular();
          desenharTotais();
        });
      }

      for (const b of tbody.querySelectorAll('[data-remover-item]')) {
        b.addEventListener('click', () => {
          const idx = Number(b.dataset.removerItem);
          const item = itens[idx];
          if (item && item.id) removidos.push(item.id);
          itens.splice(idx, 1);
          recalcular();
          desenharItens();
        });
      }

      recalcular();
    }

    function desenharTotais() {
      for (const tr of tbody.querySelectorAll('tr[data-i]')) {
        const idx = Number(tr.dataset.i);
        const celulas = tr.querySelectorAll('td');
        if (celulas[5] && itens[idx]) celulas[5].textContent = brl(itens[idx].valor_total);
      }
    }

    desenharItens();

    corpo.querySelector('#add-item').addEventListener('click', () => {
      itens.push({ descricao: '', quantidade: 1, unidade: 'UN', valor_de_custo_do_fornecedor: 0 });
      desenharItens();
    });

    corpo.querySelector('#cancelar').addEventListener('click', fechar);

    corpo.querySelector('#form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const d = ui.dadosDoForm(ev.target);
      const recebido = ev.target.querySelector('[name="recebido"]').checked;
      const botao = ev.target.querySelector('button[type="submit"]');
      botao.disabled = true;
      botao.textContent = 'Salvando…';

      try {
        await atualizar('pedidos_gerados', p.id, {
          numero: d.numero,
          status: d.status,
          data_pedido: d.data_pedido || null,
          nota_fiscal: d.nota_fiscal || null,
          nota_fiscal_em: d.nota_fiscal ? new Date().toISOString() : null,
          recebido,
          recebido_em: recebido ? new Date().toISOString() : null,
          observacao: d.observacao || null,
        });

        for (const id of removidos) {
          await sb.from('pedido_itens').delete().eq('id', id);
        }

        for (const i of itens) {
          // valor_total é coluna gerada no banco (qtd × custo)
          const dados = {
            sku: i.sku || null,
            descricao: i.descricao || '(sem descrição)',
            quantidade: Number(i.quantidade) || 0,
            unidade: i.unidade || 'UN',
            valor_de_custo_do_fornecedor: Number(i.valor_de_custo_do_fornecedor) || 0,
          };
          if (i.id) await sb.from('pedido_itens').update(dados).eq('id', i.id);
          else await sb.from('pedido_itens').insert({ ...dados, pedido_id: p.id });
        }

        fechar();
        ui.toast('Pedido atualizado.');
        selecionado = null;
        ctx.recarregar();
      } catch (erro) {
        ui.toast(erro.message, 'erro');
        botao.disabled = false;
        botao.textContent = 'Salvar';
      }
    });
  }

  // ------------------------------------------------------------- ações
  raiz.querySelector('#editar')?.addEventListener('click', () => {
    if (selecionado) modalEditar(selecionado);
  });

  raiz.querySelector('#excluir')?.addEventListener('click', async () => {
    if (!selecionado) return;
    if (!window.confirm(`Excluir o pedido ${selecionado.numero}? Os itens também serão removidos.`)) return;
    try {
      await excluir('pedidos_gerados', selecionado.id);
      ui.toast('Pedido excluído.');
      selecionado = null;
      ctx.recarregar();
    } catch (erro) { ui.toast(erro.message, 'erro'); }
  });

  raiz.querySelector('#cancelar-selecao').addEventListener('click', () => {
    selecionado = null;
    desenhar();
  });

  // ------------------------------------------------------------- modais
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
