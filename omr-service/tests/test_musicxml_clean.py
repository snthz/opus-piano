from __future__ import annotations

import xml.etree.ElementTree as ET

from app.musicxml_clean import strip_filler_rests


def score(measure_body: str) -> str:
    return (
        '<?xml version="1.0" encoding="UTF-8"?><score-partwise version="4.0"><part id="P1">'
        f'<measure number="1">{measure_body}</measure></part></score-partwise>'
    )


def note(step: str, voice: str | None = None, staff: str = "1") -> str:
    v = f"<voice>{voice}</voice>" if voice else ""
    return f"<note><pitch><step>{step}</step><octave>4</octave></pitch><duration>16</duration>{v}<staff>{staff}</staff></note>"


def rest(voice: str | None = None, staff: str = "1") -> str:
    v = f"<voice>{voice}</voice>" if voice else ""
    return f'<note><rest measure="yes"/><duration>8</duration>{v}<staff>{staff}</staff></note>'


def notes_of(musicxml: str):
    root = ET.fromstring(musicxml)
    return [(n.findtext("staff", "1"), n.findtext("voice"), n.find("rest") is not None) for n in root.iter("note")]


def test_el_silencio_de_relleno_se_va_si_el_pentagrama_tiene_voces():
    cleaned, removed = strip_filler_rests(score(rest() + note("C", "1")))
    assert removed == 1
    assert notes_of(cleaned) == [("1", "1", False)]


def test_un_pentagrama_entero_sin_voces_se_deja_como_está():
    # Aquí los silencios son la música, no relleno: quitarlos vaciaría el compás.
    original = score(rest() + note("C") + rest())
    cleaned, removed = strip_filler_rests(original)
    assert removed == 0
    assert cleaned == original


def test_cada_pentagrama_se_mira_por_separado():
    # El de arriba tiene voces (su relleno sobra); el de abajo no (se respeta).
    cleaned, removed = strip_filler_rests(score(rest(staff="1") + note("C", "1") + rest(staff="2") + note("E", staff="2")))
    assert removed == 1
    assert notes_of(cleaned) == [("1", "1", False), ("2", None, True), ("2", None, False)]


def test_un_silencio_con_voz_no_es_relleno():
    original = score(rest("1") + note("C", "1"))
    cleaned, removed = strip_filler_rests(original)
    assert removed == 0
    assert cleaned == original


def test_un_archivo_ilegible_se_devuelve_tal_cual():
    cleaned, removed = strip_filler_rests("<esto no es xml")
    assert (cleaned, removed) == ("<esto no es xml", 0)
