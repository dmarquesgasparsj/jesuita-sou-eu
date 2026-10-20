# O jesuíta sou eu

Experiência de semelhança entre uma fotografia e uma galeria de 40 santos e beatos jesuítas, pensada para tablet e telemóvel. Interface disponível em português de Portugal, espanhol, francês, inglês e coreano.

## Descarregar a aplicação

- [Instalador para Windows 10/11 x64 (.exe)](https://github.com/dmarquesgasparsj/jesuita-sou-eu/releases/latest/download/O-jesuita-sou-eu-Setup-0.7.0.exe)
- [APK Android 0.6.0, galeria anterior de 30 figuras](https://github.com/dmarquesgasparsj/jesuita-sou-eu/releases/download/v0.6.0/O-jesuita-sou-eu-Android-0.6.0.apk)
- [Versões publicadas e instruções de instalação](https://github.com/dmarquesgasparsj/jesuita-sou-eu/releases)

A aplicação web e o instalador Windows 0.7.0 incluem as 40 figuras e os modelos para funcionamento sem Internet. O APK 0.6.0 mantém 30 figuras. No Android, instala a PWA para utilizar a galeria atual. A atualização direta do APK exige a chave de assinatura original, que não foi recuperada neste ambiente; não foi gerada uma chave substituta. A versão Windows usa o Edge ou o Chrome instalado no computador e ainda não tem certificado comercial de editor. O APK tem assinatura própria do projeto. A instalação e a câmara devem ser ensaiadas nos aparelhos reais.

## Instalar e publicar no GitHub

A pasta `native/` contém as aplicações com os recursos incluídos: instalador Windows x64 (`.exe`) e APK Android. O guia [native/README.md](native/README.md) descreve a compilação, a assinatura e os requisitos. As aplicações incluem a galeria e os modelos para uso sem Internet.

A aplicação está preparada como PWA, instalável a partir do navegador no Windows e no Android. O guia [INSTALAR.md](INSTALAR.md) explica como publicar no GitHub Pages, instalar e preparar cada aparelho para uso sem Internet.

O processo automático em `.github/workflows/pages.yml` executa os testes e publica `dist/` a cada envio para `main` ou `master`. Ativa primeiro **Settings → Pages → Source → GitHub Actions** no repositório. Na primeira utilização, cria o repositório e faz a publicação conforme o guia.

## Línguas e biografias

O seletor no topo muda todos os ecrãs, instruções, mensagens, nomes e conteúdos para uma das cinco línguas. A escolha fica no endereço (`?lang=pt`, `es`, `fr`, `en` ou `ko`), permitindo voltar a abrir ou partilhar a mesma língua.

Cada santo ou beato tem dois parágrafos de biografia em cada língua. As perguntas portuguesas originais foram preservadas; as outras línguas incluem a respetiva tradução. O texto está em `dist/saints-text.json`, separado das imagens e dos descritores. As fontes biográficas estão identificadas por santo nesse ficheiro.

A mudança de língua funciona sem rede depois da preparação, não repete a comparação nem elimina a fotografia em curso. Não há chamadas a serviços de tradução.

## O que está implementado

- Abertura da câmara frontal com autorização explícita, enquadramento e contagem decrescente.
- Alternativa para carregar uma fotografia.
- Deteção de um único rosto, descritor de 128 dimensões e ordenação dos 40 retratos por distância euclidiana.
- Três resultados, biografia breve, pergunta original para conversar e créditos da imagem.
- Reinício com eliminação da fotografia; limpeza após 90 segundos de inatividade e quando se sai da página de resultado.
- Todos os modelos, imagens, textos, estilos e scripts servidos pelo próprio site.
- Service worker que guarda os recursos necessários para funcionamento sem rede; indicador de preparação no aparelho.
- Teste interno acessível em «Preparar o stand», com um retrato da galeria.

## Rapidez da comparação

O motor começa a carregar antes de se abrir a câmara. Usa o Tiny Face Detector a 320 píxeis para localizar o rosto e calcula os pontos faciais e o descritor apenas quando encontra um único rosto com tamanho suficiente. Conserva o modelo de reconhecimento e os 40 descritores da galeria. Uma segunda passagem a 416 píxeis e o detetor SSD ficam disponíveis para fotografias difíceis; o teste com retratos pintados usa SSD.

A fotografia apresentada e analisada tem no máximo 640 píxeis no lado maior. Em WebGL, a preparação executa os três modelos com um tensor vazio, antes da fotografia, para compilar os shaders; esse tensor é eliminado. Se a preparação gráfica falhar, o motor usa CPU. Os modelos continuam na memória entre participantes, sem conservar as suas fotografias. A preparação offline completa começa depois dos modelos essenciais, para dar prioridade à primeira comparação.

Dois ensaios em CPU, realizados com a galeria anterior de 25 retratos, com a mesma fotografia real de teste, passaram de 13,0 para 6,8 segundos e de 10,9 para 2,9 segundos. Em ambos, os três primeiros retratos mantiveram-se. O segundo ensaio executou diretamente `dist/face-engine.js`, partilhado com o site. A variação de duração depende também da carga e da preparação do ambiente. Estes tempos são do ambiente de desenvolvimento, não de um iPad ou Chrome real. O desempenho deve ser medido no aparelho do stand.

É possível repetir a medição com `node scripts/benchmark-face-engine.cjs /caminho/absoluto/fotografia.jpg`. Este ensaio usa os modelos reais, compara o percurso anterior com o atual e verifica que a preparação liberta o tensor temporário. Precisa de `sharp` no ambiente de desenvolvimento; não é executado por `npm test`.

## Limites desta primeira versão

A comparação é feita com representações artísticas. Não demonstra a semelhança histórica com a pessoa nem infere personalidade, crenças ou vocação. O modelo foi originalmente desenvolvido para fotografias e a qualidade dos resultados com pinturas deve ser avaliada com os participantes.

O funcionamento da câmara e do modo offline no iPad real precisa de ensaio. A publicação por si só não verifica o hardware. O navegador pode remover dados guardados; deve repetir-se a preparação antes de cada evento.

## Publicar noutro alojamento

O conteúdo de `dist/` é um site estático. Não depende de um servidor de análise, de uma base de dados ou de serviços pagos por fotografia. Pode ser servido por um alojamento HTTPS que respeite os tipos MIME de JavaScript e JSON e permita service workers e câmara.

Na Vercel, importar este repositório; `vercel.json` indica `dist/` como diretório público. A compilação faz apenas a verificação dos ficheiros. O plano de alojamento deve ser escolhido segundo as condições aplicáveis ao projeto institucional.

Um domínio próprio `.pt` ou `.com` é independente do alojamento. Depois de registado, pode ser associado à Vercel ou a outro fornecedor, configurando os registos DNS indicados por esse fornecedor. A disponibilidade e os custos do domínio só serão verificados quando se escolher o nome.

## Câmara e acesso no navegador

O acesso público ou privado é gerido em Sites. Os ficheiros do site são estáticos e podem ser abertos diretamente por HTTPS num navegador compatível. Um teste HTTP bem sucedido confirma a entrega dos ficheiros, mas não testa a câmara nem as permissões do computador do visitante.

A abertura pede a câmara imediatamente no gesto do botão, antes de preparar os modelos. O vídeo fica visível e explicitamente sem som antes de `play()`. A espera pela autorização termina ao fim de 20 segundos e a espera pela imagem ao fim de 12 segundos, recuperando os controlos. Um stream que chegue depois de expirar ou cancelar é parado. Se as preferências de resolução forem recusadas, repete-se uma vez com vídeo sem essas preferências.

Quando a janela não expõe a câmara, a política da página a bloqueia ou a autorização é negada, a interface explica o bloqueio nas cinco línguas e mostra a ligação para abrir o site à parte ou copiá-lo para o Chrome ou Safari. O site não pode alterar permissões do navegador, do sistema operativo ou da janela que o incorpora. Continua disponível o carregamento de uma fotografia.

`node scripts/check-camera-access.cjs` verifica bloqueios de política, negação de autorização, expiração, recuperação, cancelamento e paragem de streams tardios. A integração verifica que o vídeo já está visível quando começa a reprodução. Não substitui um teste com a câmara real no navegador do utilizador.

## Preparar para um stand

1. Abrir o site completo no Safari do iPad, com Internet.
2. Tocar em «Preparar o stand» e depois «Preparar este aparelho».
3. Confirmar que a galeria, comparação e recursos locais estão preparados.
4. Tirar uma fotografia real e confirmar os resultados.
5. Desligar Wi-Fi e dados móveis, recarregar o site e repetir.
6. Bloquear e desbloquear o ecrã; voltar a abrir a câmara.
7. Fazer várias dezenas de utilizações seguidas, com boa iluminação.
8. Manter o tablet alimentado e verificar novamente antes do evento.

A primeira abertura precisa de Internet para obter os recursos. Adicionar ao ecrã principal não substitui esta preparação.

## Fontes e licenças

A galeria inclui 28 santos e 12 beatos. Afonso Rodrigues (o irmão de Maiorca) é uma pessoa distinta de Afonso Rodríguez, companheiro de Roque González. O retrato de Francisco Gárate é uma representação escultórica identificada no Wikimedia Commons; a imagem de um futebolista homónimo encontrada na recolha inicial foi rejeitada e não faz parte do site.

Os créditos de cada retrato estão em `dist/gallery.json` e nas fichas visíveis do site. Os originais preservados encontram-se em `source-portraits/`; os retratos apresentados têm recorte e redimensionamento para dar destaque ao rosto.

As imagens com licença Creative Commons mantêm a atribuição e uma ligação à licença nas fichas. Os recortes e redimensionamentos são indicados; as imagens CC BY-SA são redistribuídas sob a mesma licença. Os metadados das fontes são preservados em `scripts/portrait-sources.json` e `PORTRAIT-SOURCES.md`.

As perguntas são propostas originais para esta experiência, não citações atribuídas aos santos. As biografias resumem as páginas indicadas da Companhia de Jesus.

A biblioteca face-api.js 0.22.2 e os modelos são do projeto de Vincent Mühler / justadudewhohacks. A licença MIT está incluída em `dist/vendor/face-api-LICENSE.txt`. Apenas são utilizados os modelos de deteção, pontos faciais e descritor; não são carregados modelos de idade, género ou expressão.

## Verificação

`npm test` verifica os recursos offline, os modelos, os vetores, a sintaxe, as cinco traduções, os 400 parágrafos biográficos e a preservação das perguntas portuguesas. O teste de integração em Node verifica a troca de língua com a câmara e um resultado em curso, sem repetir inferência, bem como a eliminação da fotografia ao reiniciar. Não substitui um ensaio de câmara e disposição visual no aparelho real.

A inferência de referência pode ser repetida com `scripts/portrait-inference.cjs` e `scripts/prepare-gallery.cjs`; estes utilitários precisam de `sharp` num ambiente de desenvolvimento. O site publicado não precisa dessa dependência.

Não há recolha de fotografias, nomes, contactos ou analítica de visitantes.

## Galeria 0.7.0

Acrescenta Paulo Miki, Nicolau Owen, Edmundo Campion, Roberto Southwell, Rupert Mayer, John Sullivan, Diogo Carvalho, Francisco Pacheco, Miguel de Carvalho, Julien Maunoir. São 28 santos e 12 beatos, com 400 parágrafos biográficos nas cinco línguas. A fotografia do santuário de John Sullivan é conservada completa; o desenho do painel não é redistribuído isoladamente.
