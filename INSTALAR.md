# Instalar «O jesuíta sou eu» no Windows e no Android

## Ficheiros de instalação

A aplicação web e o instalador Windows 0.7.0 têm 40 figuras. O APK Android 0.6.0 mantém 30 figuras e a atualização direta exige a chave original. No Android, instala a PWA para usar a galeria atual.

- `O-jesuita-sou-eu-Setup-0.7.0.exe`: instalador para Windows 10/11, 64 bits. Executa-o e segue os passos. Cria atalhos e uma opção de desinstalação. Precisa de Edge ou Chrome instalado; a comparação corre no computador.
- `O-jesuita-sou-eu-Android-0.6.0.apk`: aplicação para Android 6 ou superior com WebView atualizado. Abre o APK no Android e autoriza a instalação a partir da aplicação que o descarregou, quando o sistema o pedir. A autorização da câmara é pedida quando tocas no botão da fotografia.

O instalador Windows não possui certificado comercial de assinatura. O APK tem assinatura própria do projeto; não é uma publicação na Play Store. Os pacotes ainda precisam de ensaio real da câmara nos aparelhos. O código de compilação e as notas de assinatura estão em [native/README.md](native/README.md).

## Instalação pelo navegador

A aplicação está preparada como PWA: instala-se a partir de um endereço HTTPS, fica com um ícone próprio e abre numa janela de aplicação. A mesma versão serve Windows e Android. As fotografias são analisadas no aparelho.

O GitHub guarda o código. O GitHub Pages publica a aplicação num endereço que permite instalá-la. O projeto já contém o manifesto, ícones, modelos de comparação, retratos e recursos offline. Os ficheiros publicados estão em `dist/`.

## Publicar na tua conta do GitHub

1. Em <https://github.com/new>, cria um repositório novo chamado `jesuita-sou-eu`. Escolhe **Public** para usar GitHub Pages no plano gratuito e ativa **Add a README file** para iniciar o ramo `main`.
2. No repositório, abre **Settings → Pages**. Em **Build and deployment → Source**, escolhe **GitHub Actions**.
3. Abre o repositório no GitHub Desktop: **File → Clone repository → URL** e cola a ligação do repositório. Escolhe uma pasta no computador.
4. Extrai o ZIP do projeto. Copia o conteúdo da pasta extraída para dentro da pasta clonada, incluindo `dist/`, `scripts/`, `source-portraits/` e `.github/`. Os ficheiros `README.md`, `package.json` e `INSTALAR.md` devem ficar na raiz. Substitui o README inicial.
5. No GitHub Desktop, escreve uma descrição como «Publicar aplicação instalável», faz **Commit to main** e depois **Push origin**.
6. No GitHub, acompanha o separador **Actions**. O processo «Publicar aplicação no GitHub Pages» verifica os ficheiros e publica `dist/`. A ligação final aparece em **Settings → Pages** e no resultado da publicação.

Se a conta e o nome do repositório forem os acima previstos, o endereço terá a forma `https://UTILIZADOR.github.io/jesuita-sou-eu/`. Usa o endereço que o GitHub apresentar como publicado. O endereço só fica disponível depois da primeira publicação bem sucedida.

Depois, cada envio para `main` volta a verificar e publicar a aplicação. Também podes lançar o processo em **Actions → Publicar aplicação no GitHub Pages → Run workflow**.

## Instalar no Windows

1. Abre o endereço publicado numa janela normal do **Microsoft Edge**, com Internet.
2. Clica no ícone de instalação à direita da barra de endereço e confirma **Instalar**. O Edge também disponibiliza a instalação no menu de aplicações.
3. Abre a aplicação pelo menu Iniciar ou pelo ícone criado. Quando pedida, permite a utilização da câmara.

A instalação usa o motor do navegador. Mantém o Edge instalado e atualizado. A aplicação pode ficar afixada no menu Iniciar e na barra de tarefas.

## Instalar no Android

1. Abre o endereço publicado no **Google Chrome**, com Internet.
2. Abre o menu **⋮** e procura **Instalar aplicação**. Algumas versões apresentam esta opção dentro de **Adicionar ao ecrã principal** ou **Instalar e criar atalho**.
3. Confirma a instalação e abre a aplicação pelo novo ícone. Permite a câmara quando for pedida.

O nome e a posição da opção de instalação dependem da versão e da língua do navegador. Se a instalação não aparecer numa janela integrada noutra aplicação, abre o endereço diretamente no Chrome.

## Preparar o funcionamento sem Internet

Em cada aparelho instalado:

1. Abre **Preparar o stand** e prepara o aparelho com Internet.
2. Aguarda que os modelos e todos os recursos estejam prontos.
3. Testa a câmara e tira uma fotografia.
4. Desliga a Internet, fecha e volta a abrir a aplicação e repete o teste.

A primeira preparação precisa de Internet. As atualizações também são obtidas quando o aparelho volta a estar ligado. Os dados offline pertencem a cada endereço: uma instalação feita a partir do GitHub Pages tem de ser preparada nesse endereço. O navegador ou o sistema podem remover dados guardados; confirma a preparação antes de um evento.

## Instalação e verificação

O manifesto usa caminhos relativos, para a aplicação funcionar tanto na raiz de um domínio como em `/jesuita-sou-eu/`. Os testes verificam os recursos offline e o refresh nos dois caminhos. Os ficheiros públicos podem ser alojados em GitHub Pages ou noutro serviço HTTPS.

Abrir `index.html` diretamente como ficheiro local não substitui o alojamento HTTPS: a câmara, os módulos e o funcionamento offline dependem do contexto do navegador. É necessário testar a instalação e a câmara nos aparelhos reais.

Para executar os testes, instala Node.js 24 e corre `npm test` na raiz do projeto. Não são necessárias dependências npm para estes testes nem uma compilação do site.

## Documentação oficial

- Instalação no Windows: <https://learn.microsoft.com/en-us/microsoft-edge/progressive-web-apps/ux>
- Instalação no Android: <https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=pt-PT>
- Configuração do GitHub Pages: <https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site>
- Publicação automática: <https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages>

Os créditos e as licenças dos retratos estão em `PORTRAIT-SOURCES.md` e nas fichas da aplicação. A licença da biblioteca de comparação está em `dist/vendor/face-api-LICENSE.txt`.
