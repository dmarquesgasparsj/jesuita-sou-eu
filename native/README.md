# Aplicações para Windows e Android

## Galerias de imagens — 0.8.0

As 40 fichas incluem duas ou três imagens, com setas, teclado, deslize no telemóvel e ampliação. As 49 imagens adicionais têm legendas nas cinco línguas, créditos individuais e funcionamento offline. O inventário encontra-se em `BIOGRAPHY-PHOTO-SOURCES.md` e os dados em `dist/biography-photos.json`. O APK 0.6.0 mantém o conteúdo anterior.

A versão Windows 0.9.0 inclui 45 figuras e os modelos. O APK 0.6.0 mantém 30 figuras; a sua atualização direta exige a chave original. A PWA Android já tem 45 figuras. A comparação funciona com os ficheiros incluídos no pacote, mesmo sem Internet. As fotografias continuam apenas na memória do aparelho.

- Windows 10/11, 64 bits: o instalador cria atalhos e uma opção de desinstalação. A janela usa o Edge ou o Chrome instalado no computador. O serviço local está limitado a `127.0.0.1`, serve apenas os ficheiros incluídos e termina depois de se fechar a janela.
- Android 6 ou superior, com Android System WebView atualizado: o APK inclui o conteúdo e pede autorização de câmara quando se toca no botão. O seletor do sistema permite escolher uma fotografia. As ligações biográficas externas abrem no navegador.

## Compilação

Executa `python native/build.py --platform all` na raiz. Podes escolher apenas `windows` ou `android` e definir `--output`.

Para Windows, são necessários Go 1.24 ou superior, NSIS 3 e Python com Pillow. O executável é compilado para Windows x64. O script pode correr em Linux. `JESUITA_GO` e `JESUITA_MAKENSIS` permitem indicar os programas; uma instalação extraída de NSIS pode precisar de `NSISDIR`.

Para Android, são necessários Java 17, Android SDK Platform 35 e Build Tools 35. Define `ANDROID_SDK_ROOT`. A variável `JESUITA_ANDROID_BUILD_TOOLS` permite indicar a pasta das ferramentas se tiver outro nome.

A assinatura Android usa `JESUITA_ANDROID_KEYSTORE` e `JESUITA_ANDROID_SIGNING_PASSWORD`. Uma chave nova é criada se o ficheiro indicado ainda não existir. Guarda a chave e a palavra-passe em privado: são necessárias para futuras atualizações da mesma instalação. Nunca as coloques no repositório ou nos ficheiros públicos.

Os pacotes desta versão ainda precisam de ensaio real da instalação, da câmara, da escolha de fotografia e do retorno à aplicação no Windows e no Android. A compilação, a assinatura APK e os testes do conteúdo podem ser verificados no ambiente de desenvolvimento. O instalador Windows não possui certificado comercial de assinatura.
