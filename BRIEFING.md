# BRIEFING — Meu Bolso

Resultado da entrevista de oito perguntas. Este briefing segue o formato CLARO e complementa o CLAUDE.md.

## C — Contexto

- **Nome do app:** Meu Bolso.
- **Quem usa:** só eu, no celular e no computador, para controlar os gastos de trabalho na estrada e com clientes.
- **Onde lanço:** quase sempre no fim do dia, com calma, numa mesa, lançando vários gastos de uma vez. Às vezes lanço na hora, pelo celular.
- **Sensação ao abrir:** tranquilidade. Tons pastéis neutros que descansam a vista: fundo areia ou bege bem claro, com detalhes em verde-sálvia (lembra papel e natureza).

## L — Limites

- **Toques:** no máximo **5 toques** para lançar um gasto, do momento em que o app abre até o gasto ficar salvo, já contando a confirmação. Digitar o valor no teclado não conta como toque.
- **O app nunca:**
  - salva um gasto sem antes mostrar um resumo (valor, categoria e data) e esperar o toque em "Confirmar". Isso vale para o lançamento à mão e para o assistente;
  - pede, guarda ou mostra senha de banco, número de conta ou número de cartão;
  - guarda a foto do cupom. A foto serve só para o assistente ler o valor, a data e o lugar, e depois é descartada;
  - envia e-mail ou mensagem;
  - usa dado de outra pessoa.
- **O que me faria desistir na primeira semana:** lentidão; muitos toques para registrar uma despesa; foto do recibo com qualidade ruim, que faça o assistente ler errado.

## A — Ação

Construir **uma tela só**, pensada primeiro para o celular de 390 px, com quatro partes, de cima para baixo.

1. **O que aparece nos primeiros cinco segundos (topo da tela)**
   - a data de hoje;
   - o total gasto no mês;
   - o total de cada categoria no mês, da maior para a menor.

2. **Lançamento à mão**
   - Um botão grande "Novo gasto".
   - Campos: valor, categoria (botões com os nomes abaixo) e data (já vem com hoje e pode ser trocada).
   - Ao tocar em "Salvar", aparece o resumo (valor, categoria e data) com os botões "Confirmar" e "Corrigir".
   - Depois de confirmar, o formulário volta limpo e pronto para o próximo gasto, porque no fim do dia lanço vários de uma vez.
   - Caminho dos 5 toques: (1) "Novo gasto" → (2) categoria → (3) campo do valor e digitação → (4) "Salvar" → (5) "Confirmar".

3. **Lista do mês**
   - Todos os gastos do mês, do mais recente para o mais antigo, com data, categoria e valor.
   - Cada gasto pode ser corrigido ou apagado.

4. **Espaço do assistente (chega na sexta)**
   - Um lugar já reservado na tela, por enquanto com o aviso "Em breve: lance um gasto por uma frase ou pela foto do cupom".
   - Quando chegar, o assistente vai preencher valor, categoria e data e mostrar o mesmo resumo com "Confirmar" antes de salvar. A foto do cupom é descartada logo depois da leitura.

**Categorias, com os meus nomes (8, contando com Outros):**

1. Refeição
2. Abastecimento
3. Pedágio e estacionamento
4. Gastos com clientes
5. Material de escritório
6. Hospedagem
7. Locações
8. Outros

## R — Resultado

Ao abrir o app, em até cinco segundos e sem rolar a tela no celular, eu respondo à pergunta **"que dia é hoje, quanto já gastei neste mês e em quê?"**: a data de hoje, o total do mês e o total de cada categoria aparecem juntos no topo.

## O — Observáveis (cinco testes que provam que o app está pronto)

1. **Cinco segundos:** abro o app no celular, já com a minha conta, e em até 5 segundos vejo a data de hoje, o total do mês e o total por categoria, sem rolar a tela.
2. **Cinco toques:** lanço um gasto de Refeição contando os toques. Do app aberto até o gasto salvo, são no máximo 5, e o total do mês e o de Refeição sobem na hora.
3. **Nada sem revisão:** começo um lançamento e toco em "Corrigir" em vez de "Confirmar". O gasto não aparece na lista e os totais não mudam.
4. **Vários no fim do dia:** lanço três gastos seguidos, de categorias diferentes. O formulário volta limpo depois de cada um, nenhum gasto se perde e cada um leva menos de 1 segundo para aparecer na lista depois de confirmado.
5. **Só eu e só o permitido:** entro com uma segunda conta de teste e não vejo nenhum gasto da primeira. Em nenhuma tela o app pede dados de banco, conta, cartão ou senha bancária. Se a internet cair, aparece uma frase em português dizendo o que fazer.
