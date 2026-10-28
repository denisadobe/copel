# Adobe Target: banner de pós-venda (cliente Protege Casa → Protege Vida)

Cenário da demo: quem **já contratou o Seguro Protege Casa** não vê mais o banner de venda dele na
home. Em primeiro lugar aparece o banner do **Protege Vida** ("Sua casa está protegida. E a sua
família?"). O mesmo vale para o app, com a mesma conta.

O que torna o cenário simples:

- **Quem é cliente** vem do Commerce (pedidos da conta logada), não do perfil do Target. Por isso
  não há configuração de identidade nem perfil compartilhado.
- **O Target só decide.** Site e app mandam parâmetros simples e recebem uma oferta JSON dizendo
  qual banner vai primeiro e qual sai.
- **Os banners continuam no AEM.** O Content Fragment `protege-vida-upsell` já existe (público
  `cliente-protege-casa`, fora da rotação normal).

## 1. O que o site envia (já implementado)

Local (decision scope): **`copel-banner-home`**. É a linha "Escopo Target" do banner da home no
Document Authoring.

Parâmetros de mbox (`data.__adobe.target`), sempre como texto:

| Parâmetro | Valores | Origem |
|---|---|---|
| `clienteProtegeCasa` | `true` / `false` | Pedidos da conta logada no Commerce (SKU `protege-casa-*`), marcado na hora ao confirmar o pedido |
| `logado` | `true` / `false` | Login do Commerce |
| `canal` | `site` (o app manda `app`) | Fixo |

O site também envia a impressão (`decisioning.propositionDisplay`) e o clique em um link do banner
escolhido (`decisioning.propositionInteract`).

Código: `scripts/web-sdk.js`, `scripts/target-profile.js`, `blocks/carousel-hero/carousel-hero-cf.js`.

## 2. Data Collection: ativar o Target no datastream

1. Abra Experience Platform Data Collection → **Datastreams** → o datastream
   `c34abba2-b513-4c27-8e6b-d477771eade9`, o mesmo do Brand Concierge, compartilhado com o Sebrae.
2. **Add Service** → **Adobe Target** → Enabled. Deixe *Property Token* e *Target Third Party ID
   Namespace* em branco. Salve.
   - Se o Target já estiver ativo nesse datastream (por causa do Sebrae), não mude nada.
   - Se o Sebrae usar um *property token*, crie a atividade da Copel na mesma property. Outra
     opção: crie uma property da Copel, inclua o token dela em *Property Token Overrides* e
     preencha `TARGET_PROPERTY_TOKEN` em `scripts/brand-concierge-config.js`.

## 3. Target: oferta, audiência e atividade

**Antes:** abra a home publicada uma vez, logado com uma conta que já tem pedido. Assim o Target
"conhece" o parâmetro `clienteProtegeCasa` e ele aparece na lista ao criar a audiência.

1. **Offers → Code offers → Create → JSON Offer**
   - Nome: `Copel – Banner Protege Vida (cliente Protege Casa)`
   - JSON:
     ```json
     {
       "bannerPath": "/content/dam/copel/banners/protege-vida-upsell",
       "ocultar": ["/content/dam/copel/banners/protege-casa"]
     }
     ```
2. **Audiences → Create Audience**
   - Nome: `Copel – Cliente Protege Casa`
   - Regra: **Custom** → `clienteProtegeCasa` → *equals (case sensitive)* → `true`
3. **Activities → Create Activity → Experience Targeting → Web → Form-based Experience Composer**
   - **Experiência 1:** audiência `Copel – Cliente Protege Casa`. Local `copel-banner-home` →
     *Change JSON Offer* → a oferta do passo 1.
   - **Experiência 2:** audiência `All Visitors`. Local `copel-banner-home` → *Default Content*.
   - A experiência 1 precisa ficar **acima** da 2 (a ordem define a prioridade).
   - **Goals & Settings:** Reporting source Adobe Target. Primary goal: *Conversion → Clicked on
     an mbox → `copel-banner-home`*.
   - Nome: `Copel – Banner home: pós-venda Protege Casa` → **Save & Close** → **Activate**.

Como a audiência só pega quem já é cliente, ativar direto não afeta os outros visitantes.

## 4. Roteiro da demo

1. Entre com uma conta **sem pedido** (crie uma em `/loja/cadastro`). A home mostra o banner do
   Protege Casa.
2. Contrate um plano do Protege Casa e confirme o pedido.
3. Volte para a home. O Protege Vida aparece em primeiro e o banner do Protege Casa sai.
4. No app, entre com a mesma conta: o mesmo banner.
5. No Target, mostre a atividade, a audiência e o relatório (impressões e cliques).

As contas usadas nos testes de pedido já têm pedidos, então já entram como clientes. Para
"recomeçar" a demo, use outra conta sem pedido.

## 5. App (instruções para a IA do app)

> Personalização do banner da home com Adobe Target (mesma atividade do site):
>
> 1. **Web SDK (alloy 2.35.1)** com a mesma configuração do Brand Concierge: datastream
>    `c34abba2-b513-4c27-8e6b-d477771eade9`, orgId `0E061E2D61F93F260A495FD6@AdobeOrg`,
>    `edgeDomain: edge.adobedc.net`, `defaultConsent: 'in'`. Uma instância só (`alloy`),
>    compartilhada com o Brand Concierge.
> 2. **Login com a mesma conta do Commerce do site:** mutation `generateCustomerToken(email,
>    password)` no endpoint GraphQL do Commerce (o mesmo do `config.json` do site, header
>    `Store: default`).
> 3. **Logado:** consulte os pedidos com `Authorization: Bearer <token>`:
>    `query { customer { orders(pageSize: 50) { items { items { product_sku } } } } }`.
>    `clienteProtegeCasa` é `"true"` se algum `product_sku` começa com `protege-casa`. Guarde o
>    resultado na sessão e marque `"true"` logo depois de um pedido.
> 4. **Ao montar a home,** em paralelo com a lista de banners, chame:
>    ```js
>    alloy('sendEvent', {
>      decisionScopes: ['copel-banner-home'],
>      renderDecisions: false,
>      data: { __adobe: { target: { clienteProtegeCasa, logado, canal: 'app' } } },
>    })
>    ```
>    Espere no máximo cerca de 1,5 s. Sem resposta, mostre a ordem normal.
> 5. **Leia** `propositions[0].items[0].data.content` (JSON: `{ bannerPath, ocultar }`):
>    - remova da lista os banners cujo `_path` está em `ocultar`;
>    - coloque o banner `bannerPath` em primeiro. Se ele não estiver na lista do canal app, busque
>      pelo path na rota do app, com a persisted query `banner-por-path`.
>
>    Sem conteúdo JSON (experiência padrão): ordem normal.
> 6. **Relatórios:** depois de exibir, envie a impressão:
>    ```js
>    alloy('sendEvent', {
>      xdm: {
>        eventType: 'decisioning.propositionDisplay',
>        _experience: { decisioning: { propositions: [{ id, scope, scopeDetails }] } },
>      },
>    })
>    ```
>    No clique do banner escolhido, faça o mesmo com
>    `eventType: 'decisioning.propositionInteract'`.
> 7. **Mantenha a decisão** nas atualizações periódicas da lista de banners (não chame o Target de
>    novo a cada atualização).
