# Ensaio do modo stand — 0.9.4

O ensaio correu no Chromium de um ambiente de testes, com WebGL e os modelos reais da aplicação. As [50 fotografias oficiais de domínio público](https://github.com/unitedstates/images) foram selecionadas de forma repetível a partir da revisão `aec3e4a88af843b282c0576f420b930f6a9a46ad`. Não foram incluídas no site nem usadas para treinar o modelo. O [registo do ensaio](https://github.com/dmarquesgasparsj/jesuita-sou-eu/actions/runs/43219398672) contém os resultados por ciclo.

- **Ficheiros:** 50 fotografias diferentes consecutivas na mesma página; 50 resultados, 19 figuras distintas. Sebastião Kimura foi o resultado mais frequente (9/50). Inácio de Azevedo não apareceu como primeiro resultado nesta amostra.
- **Câmara:** 15 capturas consecutivas no modo stand, com câmara simulada e o mesmo enquadramento; 15 resultados. O cancelamento parou a câmara.
- **Recursos:** 185 tensores na 10.ª, 25.ª e 50.ª comparações. Sem pedidos externos ou envios da fotografia observados no navegador do ensaio; câmara desligada e imagem temporária descartada ao mostrar o resultado. Um ficheiro sem rosto foi rejeitado e a comparação seguinte funcionou.
- **Luz:** entre 12 fotografias e versões escurecidas com uma alteração de temperatura de cor, a versão 0.9.3 manteve o primeiro resultado em 9/12 pares; a 0.9.4 em 10/12. Nenhuma das duas rejeitou as variantes.

O ensaio compara estabilidade e mede recursos do modelo, não mede semelhança objetiva nem equidade entre populações. A amostra de retratos oficiais não representa os visitantes do stand. A câmara física, a gestão de memória do tablet e as condições do local precisam de ensaio no aparelho: comparar 20–30 vezes, passar para outra aplicação e voltar, bloquear o ecrã, e repetir sem rede. Usar luz frontal difusa e enquadrar apenas o rosto do participante.

Reprodução: preparar Chromium com Playwright e a biblioteca Sharp, conservar o histórico Git e executar `node scripts/check-stand-session.cjs`. O teste não grava as fotografias no repositório.
