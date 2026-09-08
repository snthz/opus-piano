"""
Limpieza del MusicXML que escribe oemer.

oemer intercala en cada compás silencios sin `<voice>`, marcados además como
silencios de compás completo (`<rest measure="yes"/>`) aunque duren media
negra: son el relleno con el que coloca en el tiempo las voces que sí numera.
Quien lee el archivo mirando los `<backup>` los interpreta bien, pero para
cualquiera que recorra las notas en orden —como hace Opus Piano, que dibuja una
voz por pentagrama— son notas fantasma que descuadran el compás y ensucian la
partitura con silencios que no están impresos.

Se quitan solo donde no hacen falta: en un pentagrama de un compás en el que
también hay notas con voz. Si todo el pentagrama viene sin voz, se deja tal
cual, porque entonces eso es la música.
"""

from __future__ import annotations

import xml.etree.ElementTree as ET


def _staff(note: ET.Element) -> str:
    return note.findtext("staff", "1")


def strip_filler_rests(musicxml: str) -> tuple[str, int]:
    """Devuelve el MusicXML sin los silencios de relleno y cuántos ha quitado."""
    try:
        root = ET.fromstring(musicxml)
    except ET.ParseError:
        # Si no se puede leer, se devuelve tal cual: ya fallará más adelante
        # quien tenga que fallar, con un error más claro que este.
        return musicxml, 0

    removed = 0
    for measure in root.iter("measure"):
        notes = measure.findall("note")
        voiced = {_staff(n) for n in notes if n.findtext("voice")}
        for note in notes:
            if _staff(note) in voiced and not note.findtext("voice") and note.find("rest") is not None:
                measure.remove(note)
                removed += 1

    if not removed:
        return musicxml, 0
    return ET.tostring(root, encoding="unicode", xml_declaration=True), removed
