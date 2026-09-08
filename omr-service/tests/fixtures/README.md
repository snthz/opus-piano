# Partituras de prueba

`bach-wtk1-prelude1.pdf` — J. S. Bach, Preludio n.º 1 en do mayor (BWV 846), grabado con LilyPond
por el [Mutopia Project](https://www.mutopiaproject.org/ftp/BachJS/BWV846/wtk1-prelude1/), de
dominio público. Una página A4 impresa y limpia, dos pentagramas y semicorcheas seguidas: es el
caso denso, el que peor se le da a oemer.

No lo usa ningún test automático —una página son minutos de CPU—, sino la comprobación a mano:

```bash
./.venv/bin/python -m app.omr_worker <(python -c "…") /tmp/salida.musicxml   # o, más fácil:
curl -F file=@tests/fixtures/bach-wtk1-prelude1.pdf localhost:8000/v1/transcribe
```
