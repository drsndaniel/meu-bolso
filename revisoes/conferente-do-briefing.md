# Relatório do conferente-do-briefing — Meu Bolso

| Teste do briefing | Resposta | Motivo | Gravidade |
|---|---|---|---|
| 1. Cinco segundos: data de hoje, total do mês e total por categoria no topo, sem rolar | SÓ DÁ PARA SABER ABRINDO O APP | O código põe a data, o total do mês e as barras por categoria (da maior para a menor) no topo, mas só abrindo no celular de 390 px dá para ver o tempo de carga e se tudo cabe sem rolar. | BAIXA |
| 2. Cinco toques: gasto de Refeição, e o total do mês e o de Refeição sobem na hora | CUMPRE | O caminho é categoria, valor, "Salvar" e "Confirmar", no máximo 4 toques. Depois de gravar, `carregarGastos()` refaz o total e as barras. Não existe o botão "Novo gasto" que o briefing pedia, porque o formulário já fica aberto (isso está em "O que falta"). | — |
| 3. Nada sem revisão: "Corrigir" em vez de "Confirmar" | CUMPRE | "Salvar" só abre o resumo, e o gasto só é gravado dentro de `confirmar()`. "Corrigir" zera `gastoPendente` e volta ao formulário, sem gravar e sem mudar lista ou totais. | — |
| 4. Vários no fim do dia: três gastos seguidos, formulário limpo, menos de 1 segundo na lista | SÓ DÁ PARA SABER ABRINDO O APP | Depois de confirmar, valor, descrição e categoria são limpos e o formulário volta (a data continua a mesma, o que ajuda no lote). O tempo de menos de 1 segundo depende da rede e do Supabase, e só se mede com o app aberto. | BAIXA |
| 5. Só eu e só o permitido: segunda conta não vê gastos da primeira; nenhum dado bancário; frase em português sem internet | SÓ DÁ PARA SABER ABRINDO O APP | Nenhuma tela pede dados de banco, conta, cartão ou senha bancária (só o e-mail e a senha de entrada do app). `traduzirErro` dá frases em português para falta de internet. O app grava `dono` e não filtra por dono nas consultas, então o isolamento entre contas depende da proteção por linha no Supabase, que não está nos arquivos. | MÉDIA |

**Categorias:** as 8 categorias de `app/configuracao.js` são idênticas às do briefing, com os mesmos nomes e a mesma grafia. Não sobra nenhuma e não falta nenhuma.

## O que falta
- O assistente grava o gasto sem mostrar o resumo (valor, categoria, data) e sem esperar "Confirmar". O app só envia a frase ou a foto para `/api/assistente`, e quando a resposta traz `lancou` ele apenas recarrega a lista. O briefing exige o resumo com "Confirmar" também no assistente. Gravidade ALTA. Não conferi o servidor do assistente, porque não está em `app/`.
- Não existe o botão grande "Novo gasto"; o formulário já fica aberto. Gravidade BAIXA, porque dá menos toques, mas é diferente do pedido.
- Os gastos da lista só podem ser apagados; não dá para corrigir. O briefing pede "corrigido ou apagado". Gravidade MÉDIA.
- O formulário tem um campo extra, "Onde ou com o quê", que o briefing não listou (valor, categoria, data). Gravidade BAIXA.
- A tela tem um "Resumo da semana" e o assistente já está ativo no lugar do aviso "Em breve", o que vai além da tela de quatro partes do briefing. Gravidade BAIXA.
- Falta confirmar abrindo o app: os 5 segundos sem rolar no celular de 390 px, o tempo de menos de 1 segundo por gasto, e o isolamento entre duas contas no Supabase.
