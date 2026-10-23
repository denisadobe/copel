# Commerce (sandbox) — passo a passo no Admin para a Copel

Sandbox: Adobe Commerce as a Cloud Service (o mesmo do demo Sebrae), loja **default** (Main Website → Main Website Store → Default Store View).
Endpoint storefront: `https://na1-sandbox.api.commerce.adobe.com/TcvPqpzQp1aRq3ohMQt2ct/graphql`

Tempo estimado: 15 a 20 minutos.

## 1. Produtos (2 produtos virtuais)

**Catalog → Products → Add Product (seta ao lado) → Virtual Product.** Repita para cada plano:

| Campo | Plano Básico | Plano Premium |
|---|---|---|
| Enable Product | Yes | Yes |
| Attribute Set | Default | Default |
| Product Name | Seguro Protege Casa — Plano Básico | Seguro Protege Casa — Plano Premium |
| SKU | `protege-casa-basico` | `protege-casa-premium` |
| Price | 24.90 | 39.90 |
| Tax Class | None | None |
| Quantity | 9999 | 9999 |
| Stock Status | In Stock | In Stock |
| Visibility | Catalog, Search | Catalog, Search |
| Product in Websites | ✅ Main Website | ✅ Main Website |
| URL Key | `seguro-protege-casa-basico` | `seguro-protege-casa-premium` |
| Short Description | Seguro residencial com cobertura para incêndio, raio, explosão, vendaval, ruptura de tubulações e responsabilidade civil. Pago na conta de luz. | Proteção completa: coberturas do Básico com limites maiores, roubo, assistência PET e serviços residenciais 24h. Pago na conta de luz. |

Imagem (opcional, em **Images and Videos**): o selo ou a foto do Protege Casa.

**Save.** O Catalog Service leva alguns minutos para indexar. Para conferir, este comando tem que listar os dois SKUs:

```bash
curl -s https://na1-sandbox.api.commerce.adobe.com/TcvPqpzQp1aRq3ohMQt2ct/graphql \
  -H 'Content-Type: application/json' -H 'Store: default' \
  -H 'Magento-Store-Code: main_website_store' -H 'Magento-Store-View-Code: default' -H 'Magento-Website-Code: base' \
  -d '{"query":"{ products(skus:[\"protege-casa-basico\",\"protege-casa-premium\"]) { sku name price_range { minimum_price { final_price { value currency } } } } }"}'
```

> A loja é em USD. O site troca o código da moeda e mostra **R$ 24,90**. É um ajuste de demo: no Admin os pedidos aparecem em USD com o mesmo valor numérico.

## 2. Pagamento "Cobrança na fatura de energia"

**Stores → Configuration → Sales → Payment Methods → Check / Money Order** (escopo *Default Config*; desmarque "Use system value" onde precisar):

| Campo | Valor |
|---|---|
| Enabled | Yes |
| Title | Cobrança na fatura de energia |
| New Order Status | Pending |
| Payment from Applicable Countries | All Allowed Countries |
| Make Check Payable to | *(vazio)* |
| Send Check to | *(vazio)* |

**Save Config.**

> Atenção: a loja é a mesma do Sebrae, então esse método também passa a aparecer lá. Nos pedidos grátis do Sebrae, o método `free` continua sendo o escolhido automaticamente.

## 3. Cadastro de clientes (para a demo funcionar na hora)

**Stores → Configuration → Customers → Customer Configuration:**

- **Create New Account Options → Require Emails Confirmation = No.** O cliente entra logo depois de se cadastrar.
- **Name and Address Options → Show Telephone = Required.** Já é o padrão; o checkout preenche o telefone.

**Stores → Configuration → General → General → Country Options:** confira se **Brazil** está em *Allow Countries*.

## 4. Conferência rápida

- [ ] Os dois SKUs aparecem no comando curl acima.
- [ ] O método "Cobrança na fatura de energia" está habilitado.
- [ ] O cadastro de cliente não exige confirmação por e-mail.

Depois disso, avise: eu testo o fluxo completo (cadastro → login → contratar → checkout → pedido) contra o sandbox real.
