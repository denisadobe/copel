# Adobe Target: faixa de promoção por jornada (site e app)

Validado em 04/11/2026 com uma conta nova, do anônimo à compra, no site e no app.

## Jornada

| Momento | Site (home) | App (home) |
|---|---|---|
| Visitante anônimo | sem faixa | sem faixa |
| Logado, sem pedido | faixa "Acesse o APP da Copel" | sem faixa |
| Comprou o Protege Casa | faixa "Protege Vida" ("Sua casa está protegida. E a sua família?") | faixa "Protege Vida" |

O banner principal da home (Content Fragments do AEM) não muda: a faixa fica entre o banner e os
cards de serviço.

## Quem decide o quê

- **"Comprou" vem do Commerce**, pelos pedidos da conta logada (SKU `protege-casa-*`, em qualquer
  status). Site e app consultam os pedidos e mandam o resultado ao Target a cada visita. Por isso o
  resultado é o mesmo em qualquer canal, navegador ou dispositivo logado com a mesma conta.
- **O Target só escolhe a oferta.** Site e app são visitantes diferentes para o Target (perfis e
  relatórios separados).

## Site

- `at.js` 2.11.9 (`scripts/at.js`), iniciado no `head.html`, sem body hiding. Client
  `adobedemoamericas403`.
- Atividade **`Copel | Site | Promo por jornada (VEC XT)`** (VEC, seletor `#promo-strip`, bloco
  `promo-strip` da home).
- Parâmetros de perfil enviados pelo site (`scripts/target-profile.js`):
  `profile.copel_logado` e `profile.copel_comprou_seguro` (`true` / `false`).
- O estado da compra fica guardado no navegador desde a confirmação do pedido; num navegador novo
  o site consulta os pedidos uma vez. Depois da compra a sessão do Target recomeça, e se o Target
  responder "sem oferta" (ele aplica o perfil novo com alguns segundos de atraso) o site pergunta
  de novo, sem pular o layout (o espaço da faixa fica reservado para quem está logado).
- Tempos medidos (sem cache, rede 4G): faixa visível em ~0,55 s depois da compra; ~0,75 s na
  primeira visita logada de uma conta nova; CLS ≤ 0,013.

## App

- O servidor do app chama a **Target Delivery API** (sem at.js e sem Web SDK), só para cliente
  com Protege Casa: mbox `copel-app-promo`, parâmetro `protegeCasa=true`.
- Atividade **`Copel | App | Promo pós-compra (XT)`**, audiência `Copel | App | Tem Protege Casa`.
  Oferta JSON `{ exibir, titulo, texto, ctaTexto, ctaLink }`; o app só mostra a faixa com
  `exibir: true`.
- O corpo da chamada não aceita `imsOrganizationId` (a API responde 400): veja o corpo certo em
  `context` + `id.thirdPartyId` + `execute.mboxes`.

## Roteiro da demo

1. Abra a home do site e a do app sem login: nenhuma faixa.
2. No site, crie uma conta em `/loja/cadastro` (ou entre com uma conta sem pedido) e volte à home:
   faixa "Acesse o APP da Copel". No app, entre com a mesma conta: sem faixa.
3. No site, contrate o Seguro Protege Casa até "Pedido confirmado".
4. Volte à home do site: faixa "Protege Vida".
5. No app, com a mesma conta: faixa "Protege Vida".
6. Opcional: entre com a mesma conta em outro navegador ou no celular: faixa "Protege Vida".
7. No Target, mostre as duas atividades, as audiências e os relatórios.

Cada conta só serve uma vez para mostrar a mudança (depois da compra ela já é cliente). Para
recomeçar, use uma conta nova. Contas de teste usadas: `copel.teste.<data><letra>@example.com`,
senha `CopelDemo#2026`.
