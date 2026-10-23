# Copel demo — handoff para o app (Vercel)

Contexto para a IA que constrói o app. Atualizado em 23/10/2026.

## 1. Visão geral

Demo de uma distribuidora de energia (Copel) mostrando **um conteúdo, vários canais**:

| Peça | Papel | Onde |
|---|---|---|
| **Site** | AEM Edge Delivery Services (EDS), autoria no Document Authoring (DA) | repo `denisadobe/copel`, site `copel` |
| **Conteúdo headless** | AEM Sites as a Cloud Service: Content Fragments + GraphQL (persisted queries) | instância AEM a definir (fase 3) |
| **Venda de serviço** | Adobe Commerce as a Cloud Service (SaaS), sandbox compartilhado com o demo Sebrae | endpoint GraphQL na seção 3.2 |
| **App** | Next.js (ou similar) na Vercel; consome AEM (conteúdo) e Commerce (catálogo, login, carrinho, pedido) | este projeto |

Não há SSO, Learning Manager nem backend próprio (Runtime). O login é **só o do Commerce** (cliente da loja), o mesmo no site e no app.

## 2. Status do site (o que já existe)

Migrado do site atual `https://www.copel.com/site/`, com identidade visual Copel:

| Página | Caminho EDS | Conteúdo |
|---|---|---|
| Home | `/` | banner rotativo, serviços rápidos, notícias, app, casa/empresa, painéis institucionais, atalhos, diretório de links |
| Atendimento: Falta de luz | `/copel-distribuicao/falta-de-luz` | serviço "Sem Luz" da Copel embutido em iframe (`https://www.copel.com/slwweb/publico/semluz/inicio.jsf`) + instruções app/SMS |
| Notícias | `/noticias` | destaque + lista de notícias |
| Venda de serviço | `/seguro-protege-casa` | hero, coberturas, passo a passo, **planos Básico R$ 24,90 / Premium R$ 39,90**, FAQ |
| Componentes | `/componentes` | vitrine dos 15 componentes e variações |

**Ainda não publicado.** O trabalho está só localmente (branch `site-migracao`, sem push) e o DA ainda tem o conteúdo padrão do template. Os endpoints EDS abaixo passam a responder depois do push da branch e do upload/preview do conteúdo no DA.

## 3. Endpoints

### 3.1 Site EDS (público, sem autenticação)

- Preview: `https://main--copel--denisadobe.aem.page{path}` (branch: `https://{branch}--copel--denisadobe.aem.page{path}`)
- Live: `https://main--copel--denisadobe.aem.live{path}`
- HTML semântico de qualquer página ou fragmento: `{host}{path}.plain.html` (ex.: `/noticias.plain.html`, `/nav.plain.html`, `/footer.plain.html`)
- Imagens publicadas: `{host}/media_<hash>.<ext>?width=750&format=webply&optimize=medium`
- Listagem JSON de páginas (query index): **ainda não configurado**. Se o app precisar listar páginas do site, configuramos `query-index` em tools.aem.live. **Para notícias e banners, use o AEM GraphQL (3.3), não o EDS.**

### 3.2 Adobe Commerce (SaaS sandbox, público para storefront)

- GraphQL (Core + Catalog Service, um único endpoint):
  `https://na1-sandbox.api.commerce.adobe.com/TcvPqpzQp1aRq3ohMQt2ct/graphql`
- Cabeçalhos obrigatórios (sem `x-api-key`, sem environment id):
  ```
  Content-Type: application/json
  Store: default
  Magento-Store-Code: main_website_store
  Magento-Store-View-Code: default
  Magento-Website-Code: base
  ```
  Os códigos de store podem mudar quando criarmos a loja Copel no sandbox (fase do e-commerce). Deixe-os em variáveis de ambiente.
- Produto previsto (**ainda não criado**): 1 serviço virtual, "Seguro Protege Casa", com 2 planos
  - SKU `protege-casa-basico`: R$ 24,90/mês
  - SKU `protege-casa-premium`: R$ 39,90/mês, selo "Mais Vendido"
- Operações que o app vai usar (GraphQL padrão do Commerce):
  - Catálogo: `products(skus: [...])` ou `productSearch` (Catalog Service), com nome, preço e atributos
  - Login: `generateCustomerToken(email, password)` → token Bearer; cadastro: `createCustomerV2`
  - Carrinho: `createEmptyCart` / `customerCart`, `addProductsToCart`
  - Checkout (virtual, sem entrega): `setBillingAddressOnCart` (**endereço de cobrança e telefone são obrigatórios mesmo para produto virtual**), `setPaymentMethodOnCart` (método a definir: `checkmo` ou `free`), `placeOrder`
  - Pedidos: `customer { orders { items { number status total { grand_total { value currency } } items { product_sku product_name } } } }`
- Regras aprendidas no projeto Sebrae:
  - Nomes de cliente com `+` ou símbolos são recusados; limpe antes de enviar.
  - Para o mesmo login valer no site EDS, o site usa o cookie `auth_dropin_user_token`. O app guarda o seu próprio token, e a conta e os pedidos são os mesmos.

### 3.3 AEM headless (Content Fragments) — fase 3, a criar

- Instância: AEM Sites as a Cloud Service (**Author/Publish a definir**)
- Endpoint previsto (persisted queries, GET, cacheável):
  `https://publish-p<PROGRAM>-e<ENV>.adobeaemcloud.com/graphql/execute.json/copel/<query>;<param>=<valor>`
- Configuração: `/conf/copel`, Content Fragments em `/content/dam/copel/noticias` e `/content/dam/copel/banners`
- Persisted queries previstas: `copel/noticias-lista` (limit, offset, categoria), `copel/noticia-por-slug` (slug), `copel/banners-por-canal` (canal = `site` | `app`)
- Até a instância existir, use os JSON de exemplo da seção 4 como mock, com o mesmo formato.

## 4. Modelos de Content Fragment (mesmos campos dos componentes do site)

O site já tem os componentes com exatamente esses campos (`cards-news` e `carousel-hero`). Assim, o mesmo fragmento alimenta o site e o app.

### Notícia (`noticia`)
| Campo | Tipo | Obs. |
|---|---|---|
| `titulo` | texto curto | obrigatório |
| `slug` | texto curto | único, usado na URL |
| `resumo` | texto longo (plain) | ~200 caracteres |
| `corpo` | texto longo (rich text) | conteúdo completo |
| `imagem` | referência de conteúdo (imagem DAM) | 16:9 |
| `data` | data | exibir dd/mm/aaaa |
| `categoria` | enumeração | Notícias, Destaque, Boletim Copel, Distribuição... |
| `destaque` | booleano | primeira notícia grande |
| `linkExterno` | texto curto (URL) | opcional |

### Banner (`banner`)
| Campo | Tipo | Obs. |
|---|---|---|
| `titulo` | texto curto | obrigatório |
| `resumo` | texto longo (plain) | opcional |
| `imagem` | referência de conteúdo | desktop, ~1600×900 |
| `imagemMobile` | referência de conteúdo | opcional, vertical |
| `ctaTexto` / `ctaLink` | texto curto | botão principal |
| `ctaSecundarioTexto` / `ctaSecundarioLink` | texto curto | opcional |
| `canais` | enumeração múltipla | `site`, `app` |
| `ordem` | número | ordem no carrossel |
| `ativoDe` / `ativoAte` | data e hora | janela de exibição |
| `skuRelacionado` | texto curto | opcional: liga o banner a um produto do Commerce (ex. `protege-casa-basico`) |

### Mock JSON (formato de retorno esperado do GraphQL)
```json
{
  "data": {
    "noticiaList": {
      "items": [
        {
          "titulo": "Copel é premiada como melhor geradora e transmissora de energia do Brasil",
          "slug": "copel-e-premiada-como-melhor-geradora-e-transmissora",
          "resumo": "A Copel foi reconhecida pelo Operador Nacional do Sistema Elétrico (ONS) como a melhor geradora hidrelétrica e a melhor transmissora de energia em corrente alternada.",
          "imagem": { "_path": "/content/dam/copel/noticias/premio-ons.jpg", "_dynamicUrl": "/adobe/dynamicmedia/deliver/..." },
          "data": "2026-10-22",
          "categoria": "Notícias",
          "destaque": true,
          "linkExterno": "https://www.copel.com/site/noticias/copel-e-premiada-como-melhor-geradora-e-transmissora-de-energia-do-brasil/"
        }
      ]
    }
  }
}
```
```json
{
  "data": {
    "bannerList": {
      "items": [
        {
          "titulo": "Segurança e proteção na sua conta de luz!",
          "resumo": "Agora você pode contratar seguros de vida e residencial e pagar diretamente na fatura.",
          "imagem": { "_path": "/content/dam/copel/banners/seguro-protege.jpg" },
          "ctaTexto": "Seguro Protege Casa",
          "ctaLink": "/seguro-protege-casa",
          "canais": ["site", "app"],
          "ordem": 1,
          "skuRelacionado": "protege-casa-basico"
        }
      ]
    }
  }
}
```

## 5. Jornada sugerida para a demo

Persona: **Ana, cliente residencial da Copel**, no app e no site.

1. **Abre o app (home):** carrossel de **banners (AEM CF, canal `app`)**, atalhos de serviço e as 3 últimas **notícias (AEM CF)**. *Mensagem: o mesmo conteúdo que está no site, editado uma vez no AEM.*
2. **Falta de luz:** atalho "Falta de energia" abre o serviço da Copel (WebView ou link para `https://www.copel.com/slwweb/publico/semluz/inicio.jsf`), igual à página `/copel-distribuicao/falta-de-luz` do site.
3. **Notícia:** lista → detalhe pelo `slug` (AEM GraphQL `noticia-por-slug`).
4. **Banner do seguro:** "Seguro Protege Casa" leva à tela do produto. **Planos e preços vêm do Commerce** (`products(skus: [...])`). Textos de apoio (coberturas, FAQ) podem vir do AEM, ou ficar fixos na v1.
5. **Contratar:** login com a conta da loja (**Commerce `generateCustomerToken`**) → adiciona o plano ao carrinho → checkout expresso (só dados de cobrança e telefone, sem entrega) → `placeOrder` → tela de confirmação com o número do pedido.
6. **Meus pedidos:** lista os pedidos do Commerce. O mesmo pedido aparece se a Ana entrar no site (`/loja/conta`, fase do e-commerce). *Mensagem: um cliente, uma conta e um histórico em todos os canais.*
7. **Momento "uau" para o autor (opcional):** editar o título de um banner no AEM e publicar. O app e o site mudam juntos.

### Quem fornece o quê
| Funcionalidade | AEM (CF + GraphQL) | Commerce | EDS (site) |
|---|---|---|---|
| Banners da home | ✅ fonte | — | consome o mesmo CF (fase 3) |
| Notícias | ✅ fonte | — | consome o mesmo CF (fase 3) |
| Produto, plano, preço | textos de marketing | ✅ fonte (SKU, preço) | bloco `cards-plans` com `data-sku` |
| Login e cadastro | — | ✅ | drop-ins Commerce |
| Carrinho, checkout, pedidos | — | ✅ | drop-ins Commerce |
| Serviços Copel (Sem Luz etc.) | — | — | iframe; no app, WebView ou link |

## 6. Identidade visual (para o app parecer o site)

- **Cores:** laranja Copel `#F5821E` (barras e marca), laranja acessível para botões com texto branco `#C85000` (hover `#A84300`), laranja de títulos `#E06000`, amarelo `#FDB422`, grafite `#373A3C` (rodapé), texto `#151C21`, cinza claro `#F2F4F6`, borda `#E3E6E9`.
- **Fontes:** Quenda (títulos, peso 500) e Univers LT 55 Roman (texto), servidas pela Copel com CORS liberado:
  - `https://www.copel.com/site/wp-content/uploads/2021/12/Quenda-Medium.ttf`
  - `https://www.copel.com/site/wp-content/uploads/2021/12/Univers-LT-55-Roman.ttf`
  - Só existe um peso de cada. Não use bold/light sintético nos títulos (`font-synthesis: none`).
- **Forma:** cantos de 6/12/20px, sombra suave em cards `0 4px 18px rgb(21 28 33 / 8%)`, botões com altura mínima de 48px.
- **Logo:** `https://www.copel.com/site/wp-content/uploads/2024/08/logo-copel-cor-assinatura-email.png` (colorida); a versão branca é usada no header e no footer do site.

## 7. Pendências e decisões em aberto

1. **Publicar o site:** push da branch, upload do conteúdo para o DA e preview. Isso libera os endpoints da seção 3.1.
2. **E-commerce (próxima fase):** criar o produto e os SKUs no sandbox, definir a store view da Copel e o método de pagamento, e criar as páginas de loja do site (`/loja/entrar`, `cadastro`, `conta`, `checkout`, `pedido`).
3. **AEM headless (fase 3):** definir a instância AEM, criar os modelos `noticia` e `banner`, as persisted queries e a configuração de CORS para o domínio da Vercel. Depois, ligar os blocos do site aos mesmos fragmentos.
4. **Segredos:** nenhum segredo é necessário no app para as leituras públicas (Commerce storefront e persisted queries publicadas). Tokens de cliente ficam só na sessão do usuário. Nunca coloque credenciais no código ou no prompt.
