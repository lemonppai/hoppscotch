# -*- coding: utf-8 -*-
"""Fill the new OpenAPI-docs / refresh i18n keys into every locale.

Insertion is order-preserving and append-only so the diff stays a pure
addition per file; `en.json` is the source of truth and is skipped.
"""

import collections
import json
import os
import sys

LOCALES_DIR = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "..",
    "..",
    "packages",
    "hoppscotch-common",
    "locales",
)

SCHEMA_ORDER = [
    "collapse",
    "copy",
    "copied",
    "copy_failed",
    "description",
    "expand",
    "field",
    "required",
    "title",
    "type",
]

COLL_ORDER = [
    "refresh_from_source",
    "refresh_success",
    "refresh_fetch_failed",
    "refresh_parse_failed",
    "refresh_no_source",
    "refresh_missing",
    "connect_openapi_source",
    "connect_openapi_source_label",
    "connect_openapi_source_description",
    "connect_openapi_source_placeholder",
    "connect_openapi_source_invalid",
]

# schema field order used below: title, field, type, required, description,
# expand, collapse, copy, copied, copy_failed
# collection order: refresh_from_source, refresh_success, refresh_fetch_failed,
# refresh_parse_failed, refresh_no_source, refresh_missing,
# connect_openapi_source, connect_openapi_source_label,
# connect_openapi_source_description, connect_openapi_source_placeholder,
# connect_openapi_source_invalid
DATA = {
    "af": dict(
        s=["Skema-velde", "Veld", "Tipe", "Vereis", "Beskrywing", "Alles uitbrei", "Alles vou",
           "Kopieer dokumentasie", "Skema-velde as Markdown gekopieer", "Kon nie skema-velde kopieer nie"],
        r="Beskrywing",
        c=["Verfris vanaf OpenAPI",
           "Versameling verfris ({added} bygevoeg, {updated} opgedateer, {removed} nie meer in die spesifikasie nie)",
           "Kon nie die OpenAPI-dokument se URL bereik nie",
           "Die OpenAPI-dokument kon nie ontleed word nie",
           "Hierdie versameling het geen OpenAPI-bron om van te verfris nie",
           "Versameling bestaan nie meer nie",
           "Koppel OpenAPI-bron", "OpenAPI-dokument-URL",
           "Hierdie versameling het geen OpenAPI-bron nie. Voer die dokument-URL een keer in; dit word vir toekomstige verfrissings onthou.",
           "Voorbeeld: https://example.com/openapi.json", "Voer 'n geldige http(s)-URL in"],
    ),
    "ar": dict(
        s=["حقول المخطط", "الحقل", "النوع", "مطلوب", "الوصف", "توسيع الكل", "طي الكل",
           "نسخ التوثيق", "تم نسخ حقول المخطط بصيغة Markdown", "تعذّر نسخ حقول المخطط"],
        r="الوصف",
        c=["تحديث من OpenAPI",
           "تم تحديث المجموعة (أُضيف {added}، حُدّث {updated}، {removed} لم يعد في المواصفة)",
           "تعذّر الوصول إلى رابط مستند OpenAPI",
           "تعذّر تحليل مستند OpenAPI",
           "لا تحتوي هذه المجموعة على مصدر OpenAPI للتحديث منه",
           "المجموعة لم تعد موجودة",
           "ربط مصدر OpenAPI", "رابط مستند OpenAPI",
           "لا تحتوي هذه المجموعة على مصدر OpenAPI مسجّل. أدخل رابط المستند مرة واحدة وسيُحفظ للتحديثات القادمة.",
           "مثال: https://example.com/openapi.json", "أدخل رابط http(s) صالحًا"],
    ),
    "ca": dict(
        s=["Camps de l'esquema", "Camp", "Tipus", "Obligatori", "Descripció", "Expandeix-ho tot",
           "Replega-ho tot", "Copia la documentació", "Camps de l'esquema copiats com a Markdown",
           "No s'han pogut copiar els camps de l'esquema"],
        r="Descripció",
        c=["Actualitza des d'OpenAPI",
           "Col·lecció actualitzada ({added} afegits, {updated} actualitzats, {removed} ja no a l'especificació)",
           "No s'ha pogut accedir a l'URL del document OpenAPI",
           "No s'ha pogut analitzar el document OpenAPI",
           "Aquesta col·lecció no té cap origen OpenAPI des del qual actualitzar",
           "La col·lecció ja no existeix",
           "Connecta un origen OpenAPI", "URL del document OpenAPI",
           "Aquesta col·lecció no té cap origen OpenAPI registrat. Introdueix l'URL del document una vegada i es recordarà per a futures actualitzacions.",
           "Exemple: https://example.com/openapi.json", "Introdueix un URL http(s) vàlid"],
    ),
    "cn": dict(
        s=["Schema 字段", "字段", "类型", "必填", "说明", "展开全部", "折叠全部",
           "复制文档", "已把 Schema 字段复制为 Markdown", "复制 Schema 字段失败"],
        r="说明",
        c=["从 OpenAPI 刷新",
           "集合已刷新（新增 {added} 个，更新 {updated} 个，{removed} 个已不在 spec 中）",
           "无法访问该 OpenAPI 文档地址",
           "OpenAPI 文档解析失败",
           "该集合没有可刷新的 OpenAPI 来源",
           "集合已不存在",
           "关联 OpenAPI 来源", "OpenAPI 文档地址",
           "该集合尚未记录 OpenAPI 来源。填写一次文档地址后会记住，之后可直接刷新。",
           "示例：https://example.com/openapi.json", "请输入有效的 http(s) 地址"],
    ),
    "cs": dict(
        s=["Pole schématu", "Pole", "Typ", "Povinné", "Popis", "Rozbalit vše", "Sbalit vše",
           "Kopírovat dokumentaci", "Pole schématu zkopírována jako Markdown",
           "Kopírování polí schématu selhalo"],
        r="Popis",
        c=["Obnovit z OpenAPI",
           "Kolekce obnovena ({added} přidáno, {updated} aktualizováno, {removed} již není ve specifikaci)",
           "Nepodařilo se připojit k URL dokumentu OpenAPI",
           "Dokument OpenAPI se nepodařilo zpracovat",
           "Tato kolekce nemá zdroj OpenAPI, ze kterého by šla obnovit",
           "Kolekce již neexistuje",
           "Připojit zdroj OpenAPI", "URL dokumentu OpenAPI",
           "Tato kolekce nemá zaznamenaný zdroj OpenAPI. Zadejte URL dokumentu jednou a zapamatuje se pro další obnovení.",
           "Příklad: https://example.com/openapi.json", "Zadejte platnou URL http(s)"],
    ),
    "da": dict(
        s=["Skemafelter", "Felt", "Type", "Påkrævet", "Beskrivelse", "Udvid alle", "Skjul alle",
           "Kopiér dokumentation", "Skemafelter kopieret som Markdown",
           "Kunne ikke kopiere skemafelter"],
        r="Beskrivelse",
        c=["Opdater fra OpenAPI",
           "Samling opdateret ({added} tilføjet, {updated} opdateret, {removed} ikke længere i specifikationen)",
           "Kunne ikke nå OpenAPI-dokumentets URL",
           "OpenAPI-dokumentet kunne ikke fortolkes",
           "Denne samling har ingen OpenAPI-kilde at opdatere fra",
           "Samlingen findes ikke længere",
           "Forbind OpenAPI-kilde", "URL til OpenAPI-dokument",
           "Denne samling har ingen registreret OpenAPI-kilde. Indtast dokumentets URL én gang, så huskes den til senere opdateringer.",
           "Eksempel: https://example.com/openapi.json", "Indtast en gyldig http(s)-URL"],
    ),
    "de": dict(
        s=["Schemafelder", "Feld", "Typ", "Erforderlich", "Beschreibung", "Alle ausklappen",
           "Alle einklappen", "Doku kopieren", "Schemafelder als Markdown kopiert",
           "Schemafelder konnten nicht kopiert werden"],
        r="Beschreibung",
        c=["Aus OpenAPI aktualisieren",
           "Sammlung aktualisiert ({added} hinzugefügt, {updated} aktualisiert, {removed} nicht mehr in der Spezifikation)",
           "Die URL des OpenAPI-Dokuments ist nicht erreichbar",
           "Das OpenAPI-Dokument konnte nicht gelesen werden",
           "Diese Sammlung hat keine OpenAPI-Quelle zum Aktualisieren",
           "Sammlung existiert nicht mehr",
           "OpenAPI-Quelle verbinden", "URL des OpenAPI-Dokuments",
           "Für diese Sammlung ist keine OpenAPI-Quelle hinterlegt. Gib die Dokument-URL einmal ein – sie wird für spätere Aktualisierungen gemerkt.",
           "Beispiel: https://example.com/openapi.json", "Gültige http(s)-URL eingeben"],
    ),
    "el": dict(
        s=["Πεδία σχήματος", "Πεδίο", "Τύπος", "Απαιτείται", "Περιγραφή", "Ανάπτυξη όλων",
           "Σύμπτυξη όλων", "Αντιγραφή τεκμηρίωσης", "Τα πεδία σχήματος αντιγράφηκαν ως Markdown",
           "Αποτυχία αντιγραφής πεδίων σχήματος"],
        r="Περιγραφή",
        c=["Ανανέωση από OpenAPI",
           "Η συλλογή ανανεώθηκε ({added} προστέθηκαν, {updated} ενημερώθηκαν, {removed} δεν υπάρχουν πλέον στην προδιαγραφή)",
           "Δεν ήταν δυνατή η πρόσβαση στη διεύθυνση του εγγράφου OpenAPI",
           "Δεν ήταν δυνατή η ανάλυση του εγγράφου OpenAPI",
           "Αυτή η συλλογή δεν έχει πηγή OpenAPI για ανανέωση",
           "Η συλλογή δεν υπάρχει πλέον",
           "Σύνδεση πηγής OpenAPI", "Διεύθυνση εγγράφου OpenAPI",
           "Αυτή η συλλογή δεν έχει καταγεγραμμένη πηγή OpenAPI. Εισαγάγετε μία φορά τη διεύθυνση του εγγράφου και θα θυμάται για μελλοντικές ανανεώσεις.",
           "Παράδειγμα: https://example.com/openapi.json", "Εισαγάγετε έγκυρη διεύθυνση http(s)"],
    ),
    "es": dict(
        s=["Campos del esquema", "Campo", "Tipo", "Obligatorio", "Descripción", "Expandir todo",
           "Contraer todo", "Copiar documentación", "Campos del esquema copiados como Markdown",
           "No se pudieron copiar los campos del esquema"],
        r="Descripción",
        c=["Actualizar desde OpenAPI",
           "Colección actualizada ({added} añadidos, {updated} actualizados, {removed} ya no están en la especificación)",
           "No se pudo acceder a la URL del documento OpenAPI",
           "No se pudo analizar el documento OpenAPI",
           "Esta colección no tiene un origen OpenAPI del que actualizar",
           "La colección ya no existe",
           "Conectar origen OpenAPI", "URL del documento OpenAPI",
           "Esta colección no tiene un origen OpenAPI registrado. Introduce la URL del documento una vez y se recordará para futuras actualizaciones.",
           "Ejemplo: https://example.com/openapi.json", "Introduce una URL http(s) válida"],
    ),
    "fi": dict(
        s=["Skeemakentät", "Kenttä", "Tyyppi", "Pakollinen", "Kuvaus", "Laajenna kaikki",
           "Kutista kaikki", "Kopioi dokumentaatio", "Skeemakentät kopioitu Markdownina",
           "Skeemakenttien kopiointi epäonnistui"],
        r="Kuvaus",
        c=["Päivitä OpenAPIsta",
           "Kokoelma päivitetty ({added} lisätty, {updated} päivitetty, {removed} ei enää määrittelyssä)",
           "OpenAPI-dokumentin URL ei ole tavoitettavissa",
           "OpenAPI-dokumenttia ei voitu jäsentää",
           "Tällä kokoelmalla ei ole OpenAPI-lähdettä päivitettäväksi",
           "Kokoelmaa ei enää ole",
           "Yhdistä OpenAPI-lähde", "OpenAPI-dokumentin URL",
           "Tälle kokoelmalle ei ole tallennettu OpenAPI-lähdettä. Anna dokumentin URL kerran, niin se muistetaan tulevia päivityksiä varten.",
           "Esimerkki: https://example.com/openapi.json", "Anna kelvollinen http(s)-URL"],
    ),
    "fr": dict(
        s=["Champs du schéma", "Champ", "Type", "Requis", "Description", "Tout développer",
           "Tout réduire", "Copier la doc", "Champs du schéma copiés en Markdown",
           "Impossible de copier les champs du schéma"],
        r="Description",
        c=["Actualiser depuis OpenAPI",
           "Collection actualisée ({added} ajoutés, {updated} mis à jour, {removed} absents de la spécification)",
           "Impossible d'atteindre l'URL du document OpenAPI",
           "Le document OpenAPI n'a pas pu être analysé",
           "Cette collection n'a pas de source OpenAPI à actualiser",
           "La collection n'existe plus",
           "Connecter une source OpenAPI", "URL du document OpenAPI",
           "Cette collection n'a aucune source OpenAPI enregistrée. Saisissez l'URL du document une fois : elle sera mémorisée pour les prochaines actualisations.",
           "Exemple : https://example.com/openapi.json", "Saisissez une URL http(s) valide"],
    ),
    "he": dict(
        s=["שדות סכימה", "שדה", "סוג", "חובה", "תיאור", "הרחב הכל", "כווץ הכל",
           "העתק תיעוד", "שדות הסכימה הועתקו כ-Markdown", "העתקת שדות הסכימה נכשלה"],
        r="תיאור",
        c=["רענון מ-OpenAPI",
           "האוסף רוענן ({added} נוספו, {updated} עודכנו, {removed} אינם במפרט יותר)",
           "לא ניתן להגיע לכתובת מסמך ה-OpenAPI",
           "לא ניתן היה לנתח את מסמך ה-OpenAPI",
           "לאוסף זה אין מקור OpenAPI לרענון",
           "האוסף כבר לא קיים",
           "חיבור מקור OpenAPI", "כתובת מסמך OpenAPI",
           "לאוסף זה לא נרשם מקור OpenAPI. הזינו את כתובת המסמך פעם אחת והיא תישמר לרענונים הבאים.",
           "דוגמה: https://example.com/openapi.json", "הזינו כתובת http(s) תקינה"],
    ),
    "hu": dict(
        s=["Séma mezők", "Mező", "Típus", "Kötelező", "Leírás", "Összes kinyitása",
           "Összes összecsukása", "Dokumentáció másolása", "Séma mezők másolva Markdownként",
           "Nem sikerült másolni a séma mezőket"],
        r="Leírás",
        c=["Frissítés OpenAPI-ból",
           "Gyűjtemény frissítve ({added} hozzáadva, {updated} frissítve, {removed} már nincs a specifikációban)",
           "Az OpenAPI dokumentum URL-je nem érhető el",
           "Az OpenAPI dokumentumot nem sikerült feldolgozni",
           "Ennek a gyűjteménynek nincs OpenAPI forrása a frissítéshez",
           "A gyűjtemény már nem létezik",
           "OpenAPI forrás csatolása", "OpenAPI dokumentum URL",
           "Ehhez a gyűjteményhez nincs rögzített OpenAPI forrás. Add meg egyszer a dokumentum URL-jét, és megjegyezzük a későbbi frissítésekhez.",
           "Példa: https://example.com/openapi.json", "Adj meg érvényes http(s) URL-t"],
    ),
    "hy": dict(
        s=["Սխեմայի դաշտեր", "Դաշտ", "Տեսակ", "Պարտադիր", "Նկարագրություն", "Բացել բոլորը",
           "Փակել բոլորը", "Պատճենել փաստաթղթերը", "Սխեմայի դաշտերը պատճենվեցին որպես Markdown",
           "Չհաջողվեց պատճենել սխեմայի դաշտերը"],
        r="Նկարագրություն",
        c=["Թարմացնել OpenAPI-ից",
           "Հավաքածուն թարմացվեց ({added} ավելացված, {updated} թարմացված, {removed} այլևս սպեցիֆիկացիայում չեն)",
           "Չհաջողվեց հասնել OpenAPI փաստաթղթի հասցեին",
           "OpenAPI փաստաթուղթը չհաջողվեց վերլուծել",
           "Այս հավաքածուն OpenAPI աղբյուր չունի թարմացնելու համար",
           "Հավաքածուն այլևս գոյություն չունի",
           "Միացնել OpenAPI աղբյուրը", "OpenAPI փաստաթղթի հասցե",
           "Այս հավաքածուն գրանցված OpenAPI աղբյուր չունի։ Մուտքագրեք փաստաթղթի հասցեն մեկ անգամ, և այն կհիշվի հետագա թարմացումների համար։",
           "Օրինակ՝ https://example.com/openapi.json", "Մուտքագրեք վավեր http(s) հասցե"],
    ),
    "id": dict(
        s=["Bidang Skema", "Bidang", "Tipe", "Wajib", "Deskripsi", "Perluas semua",
           "Ciutkan semua", "Salin dokumentasi", "Bidang skema disalin sebagai Markdown",
           "Gagal menyalin bidang skema"],
        r="Deskripsi",
        c=["Segarkan dari OpenAPI",
           "Koleksi disegarkan ({added} ditambahkan, {updated} diperbarui, {removed} tidak lagi ada di spesifikasi)",
           "Tidak dapat menjangkau URL dokumen OpenAPI",
           "Dokumen OpenAPI tidak dapat diurai",
           "Koleksi ini tidak memiliki sumber OpenAPI untuk disegarkan",
           "Koleksi tidak ada lagi",
           "Hubungkan sumber OpenAPI", "URL dokumen OpenAPI",
           "Koleksi ini belum memiliki sumber OpenAPI. Masukkan URL dokumen satu kali dan akan diingat untuk penyegaran berikutnya.",
           "Contoh: https://example.com/openapi.json", "Masukkan URL http(s) yang valid"],
    ),
    "it": dict(
        s=["Campi dello schema", "Campo", "Tipo", "Obbligatorio", "Descrizione", "Espandi tutto",
           "Comprimi tutto", "Copia documentazione", "Campi dello schema copiati come Markdown",
           "Impossibile copiare i campi dello schema"],
        r="Descrizione",
        c=["Aggiorna da OpenAPI",
           "Collezione aggiornata ({added} aggiunti, {updated} aggiornati, {removed} non più nella specifica)",
           "Impossibile raggiungere l'URL del documento OpenAPI",
           "Impossibile analizzare il documento OpenAPI",
           "Questa collezione non ha un'origine OpenAPI da cui aggiornare",
           "La collezione non esiste più",
           "Collega origine OpenAPI", "URL del documento OpenAPI",
           "Questa collezione non ha un'origine OpenAPI registrata. Inserisci l'URL del documento una volta: verrà memorizzato per i prossimi aggiornamenti.",
           "Esempio: https://example.com/openapi.json", "Inserisci un URL http(s) valido"],
    ),
    "ja": dict(
        s=["スキーマフィールド", "フィールド", "型", "必須", "説明", "すべて展開", "すべて折りたたむ",
           "ドキュメントをコピー", "スキーマフィールドを Markdown としてコピーしました",
           "スキーマフィールドのコピーに失敗しました"],
        r="説明",
        c=["OpenAPI から更新",
           "コレクションを更新しました（追加 {added} 件、更新 {updated} 件、仕様から削除 {removed} 件）",
           "OpenAPI ドキュメントの URL に接続できませんでした",
           "OpenAPI ドキュメントを解析できませんでした",
           "このコレクションには更新元の OpenAPI がありません",
           "コレクションは既に存在しません",
           "OpenAPI ソースを接続", "OpenAPI ドキュメントの URL",
           "このコレクションには OpenAPI ソースが記録されていません。ドキュメントの URL を一度入力すると、次回以降の更新で使われます。",
           "例：https://example.com/openapi.json", "有効な http(s) URL を入力してください"],
    ),
    "ko": dict(
        s=["스키마 필드", "필드", "유형", "필수", "설명", "모두 펼치기", "모두 접기",
           "문서 복사", "스키마 필드를 Markdown으로 복사했습니다",
           "스키마 필드를 복사하지 못했습니다"],
        r="설명",
        c=["OpenAPI에서 새로고침",
           "컬렉션을 새로고침했습니다 (추가 {added}개, 업데이트 {updated}개, 스펙에서 제외 {removed}개)",
           "OpenAPI 문서 URL에 연결할 수 없습니다",
           "OpenAPI 문서를 해석할 수 없습니다",
           "이 컬렉션에는 새로고침할 OpenAPI 소스가 없습니다",
           "컬렉션이 더 이상 존재하지 않습니다",
           "OpenAPI 소스 연결", "OpenAPI 문서 URL",
           "이 컬렉션에는 OpenAPI 소스가 기록되어 있지 않습니다. 문서 URL을 한 번 입력하면 이후 새로고침에 사용됩니다.",
           "예: https://example.com/openapi.json", "유효한 http(s) URL을 입력하세요"],
    ),
    "mn": dict(
        s=["Схемийн талбарууд", "Талбар", "Төрөл", "Шаардлагатай", "Тайлбар", "Бүгдийг дэлгэх",
           "Бүгдийг хумих", "Баримт бичгийг хуулах",
           "Схемийн талбаруудыг Markdown хэлбэрээр хуулсан",
           "Схемийн талбаруудыг хуулж чадсангүй"],
        r="Тайлбар",
        c=["OpenAPI-аас шинэчлэх",
           "Цуглуулгыг шинэчиллээ ({added} нэмэгдсэн, {updated} шинэчлэгдсэн, {removed} спецификацид байхгүй болсон)",
           "OpenAPI баримтын URL-д хүрч чадсангүй",
           "OpenAPI баримтыг задлан шинжилж чадсангүй",
           "Энэ цуглуулгад шинэчлэх OpenAPI эх үүсвэр байхгүй",
           "Цуглуулга байхгүй болсон",
           "OpenAPI эх үүсвэр холбох", "OpenAPI баримтын URL",
           "Энэ цуглуулгад OpenAPI эх үүсвэр бүртгэгдээгүй. Баримтын URL-ийг нэг удаа оруулбал дараагийн шинэчлэлтэд санаж үлдэнэ.",
           "Жишээ: https://example.com/openapi.json", "Хүчинтэй http(s) URL оруулна уу"],
    ),
    "nl": dict(
        s=["Schemavelden", "Veld", "Type", "Verplicht", "Beschrijving", "Alles uitvouwen",
           "Alles invouwen", "Documentatie kopiëren", "Schemavelden gekopieerd als Markdown",
           "Kopiëren van schemavelden mislukt"],
        r="Beschrijving",
        c=["Vernieuwen vanuit OpenAPI",
           "Collectie vernieuwd ({added} toegevoegd, {updated} bijgewerkt, {removed} niet meer in de spec)",
           "Kon de URL van het OpenAPI-document niet bereiken",
           "Het OpenAPI-document kon niet worden verwerkt",
           "Deze collectie heeft geen OpenAPI-bron om uit te vernieuwen",
           "Collectie bestaat niet meer",
           "OpenAPI-bron koppelen", "URL van OpenAPI-document",
           "Voor deze collectie is geen OpenAPI-bron vastgelegd. Voer de document-URL één keer in; die wordt onthouden voor volgende vernieuwingen.",
           "Voorbeeld: https://example.com/openapi.json", "Voer een geldige http(s)-URL in"],
    ),
    "no": dict(
        s=["Skjemafelt", "Felt", "Type", "Påkrevd", "Beskrivelse", "Utvid alle", "Skjul alle",
           "Kopier dokumentasjon", "Skjemafelt kopiert som Markdown",
           "Kunne ikke kopiere skjemafelt"],
        r="Beskrivelse",
        c=["Oppdater fra OpenAPI",
           "Samlingen er oppdatert ({added} lagt til, {updated} oppdatert, {removed} ikke lenger i spesifikasjonen)",
           "Kunne ikke nå URL-en til OpenAPI-dokumentet",
           "OpenAPI-dokumentet kunne ikke tolkes",
           "Denne samlingen har ingen OpenAPI-kilde å oppdatere fra",
           "Samlingen finnes ikke lenger",
           "Koble til OpenAPI-kilde", "URL til OpenAPI-dokument",
           "Denne samlingen har ingen registrert OpenAPI-kilde. Skriv inn dokumentets URL én gang, så huskes den til senere oppdateringer.",
           "Eksempel: https://example.com/openapi.json", "Skriv inn en gyldig http(s)-URL"],
    ),
    "pl": dict(
        s=["Pola schematu", "Pole", "Typ", "Wymagane", "Opis", "Rozwiń wszystko", "Zwiń wszystko",
           "Kopiuj dokumentację", "Skopiowano pola schematu jako Markdown",
           "Nie udało się skopiować pól schematu"],
        r="Opis",
        c=["Odśwież z OpenAPI",
           "Kolekcja odświeżona (dodano {added}, zaktualizowano {updated}, {removed} nie ma już w specyfikacji)",
           "Nie można połączyć się z adresem dokumentu OpenAPI",
           "Nie udało się przetworzyć dokumentu OpenAPI",
           "Ta kolekcja nie ma źródła OpenAPI do odświeżenia",
           "Kolekcja już nie istnieje",
           "Połącz źródło OpenAPI", "Adres dokumentu OpenAPI",
           "Ta kolekcja nie ma zapisanego źródła OpenAPI. Podaj adres dokumentu raz — zostanie zapamiętany przy kolejnych odświeżeniach.",
           "Przykład: https://example.com/openapi.json", "Podaj prawidłowy adres http(s)"],
    ),
    "pt-br": dict(
        s=["Campos do esquema", "Campo", "Tipo", "Obrigatório", "Descrição", "Expandir tudo",
           "Recolher tudo", "Copiar documentação", "Campos do esquema copiados como Markdown",
           "Falha ao copiar os campos do esquema"],
        r="Descrição",
        c=["Atualizar do OpenAPI",
           "Coleção atualizada ({added} adicionados, {updated} atualizados, {removed} não estão mais na especificação)",
           "Não foi possível acessar a URL do documento OpenAPI",
           "Não foi possível analisar o documento OpenAPI",
           "Esta coleção não tem uma origem OpenAPI para atualizar",
           "A coleção não existe mais",
           "Conectar origem OpenAPI", "URL do documento OpenAPI",
           "Esta coleção não tem uma origem OpenAPI registrada. Informe a URL do documento uma vez e ela será lembrada nas próximas atualizações.",
           "Exemplo: https://example.com/openapi.json", "Informe uma URL http(s) válida"],
    ),
    "pt": dict(
        s=["Campos do esquema", "Campo", "Tipo", "Obrigatório", "Descrição", "Expandir tudo",
           "Recolher tudo", "Copiar documentação", "Campos do esquema copiados como Markdown",
           "Falha ao copiar os campos do esquema"],
        r="Descrição",
        c=["Atualizar a partir do OpenAPI",
           "Coleção atualizada ({added} adicionados, {updated} atualizados, {removed} já não constam na especificação)",
           "Não foi possível aceder ao URL do documento OpenAPI",
           "Não foi possível analisar o documento OpenAPI",
           "Esta coleção não tem uma origem OpenAPI de onde atualizar",
           "A coleção já não existe",
           "Ligar origem OpenAPI", "URL do documento OpenAPI",
           "Esta coleção não tem uma origem OpenAPI registada. Introduza o URL do documento uma vez e ficará guardado para atualizações futuras.",
           "Exemplo: https://example.com/openapi.json", "Introduza um URL http(s) válido"],
    ),
    "ro": dict(
        s=["Câmpuri schemă", "Câmp", "Tip", "Obligatoriu", "Descriere", "Extinde tot",
           "Restrânge tot", "Copiază documentația",
           "Câmpurile schemei au fost copiate ca Markdown",
           "Copierea câmpurilor schemei a eșuat"],
        r="Descriere",
        c=["Reîmprospătează din OpenAPI",
           "Colecție reîmprospătată ({added} adăugate, {updated} actualizate, {removed} nu mai există în specificație)",
           "Nu s-a putut accesa URL-ul documentului OpenAPI",
           "Documentul OpenAPI nu a putut fi analizat",
           "Această colecție nu are o sursă OpenAPI din care să reîmprospăteze",
           "Colecția nu mai există",
           "Conectează sursa OpenAPI", "URL document OpenAPI",
           "Această colecție nu are o sursă OpenAPI înregistrată. Introdu URL-ul documentului o dată și va fi reținut pentru reîmprospătări viitoare.",
           "Exemplu: https://example.com/openapi.json", "Introdu un URL http(s) valid"],
    ),
    "ru": dict(
        s=["Поля схемы", "Поле", "Тип", "Обязательно", "Описание", "Развернуть все",
           "Свернуть все", "Копировать документацию", "Поля схемы скопированы в Markdown",
           "Не удалось скопировать поля схемы"],
        r="Описание",
        c=["Обновить из OpenAPI",
           "Коллекция обновлена (добавлено {added}, обновлено {updated}, {removed} больше нет в спецификации)",
           "Не удалось получить доступ к URL документа OpenAPI",
           "Не удалось разобрать документ OpenAPI",
           "У этой коллекции нет источника OpenAPI для обновления",
           "Коллекция больше не существует",
           "Подключить источник OpenAPI", "URL документа OpenAPI",
           "У этой коллекции не записан источник OpenAPI. Укажите URL документа один раз — он запомнится для следующих обновлений.",
           "Пример: https://example.com/openapi.json", "Введите корректный URL http(s)"],
    ),
    "sr": dict(
        s=["Поља шеме", "Поље", "Тип", "Обавезно", "Опис", "Прошири све", "Скупи све",
           "Копирај документацију", "Поља шеме су копирана као Markdown",
           "Копирање поља шеме није успело"],
        r="Опис",
        c=["Освежи из OpenAPI",
           "Колекција је освежена ({added} додато, {updated} ажурирано, {removed} више није у спецификацији)",
           "Није могуће доћи до URL-а OpenAPI документа",
           "OpenAPI документ није могуће рашчланити",
           "Ова колекција нема OpenAPI извор за освежавање",
           "Колекција више не постоји",
           "Повежи OpenAPI извор", "URL OpenAPI документа",
           "Ова колекција нема забележен OpenAPI извор. Унесите URL документа једном и биће запамћен за будућа освежавања.",
           "Пример: https://example.com/openapi.json", "Унесите исправан http(s) URL"],
    ),
    "sv": dict(
        s=["Schemafält", "Fält", "Typ", "Obligatorisk", "Beskrivning", "Expandera alla",
           "Fäll ihop alla", "Kopiera dokumentation", "Schemafält kopierade som Markdown",
           "Det gick inte att kopiera schemafälten"],
        r="Beskrivning",
        c=["Uppdatera från OpenAPI",
           "Samlingen uppdaterad ({added} tillagda, {updated} uppdaterade, {removed} finns inte längre i specifikationen)",
           "Det gick inte att nå OpenAPI-dokumentets URL",
           "OpenAPI-dokumentet kunde inte tolkas",
           "Den här samlingen har ingen OpenAPI-källa att uppdatera från",
           "Samlingen finns inte längre",
           "Anslut OpenAPI-källa", "URL till OpenAPI-dokument",
           "Den här samlingen har ingen registrerad OpenAPI-källa. Ange dokumentets URL en gång, så sparas den för framtida uppdateringar.",
           "Exempel: https://example.com/openapi.json", "Ange en giltig http(s)-URL"],
    ),
    "th": dict(
        s=["ฟิลด์ของสคีมา", "ฟิลด์", "ชนิด", "จำเป็น", "คำอธิบาย", "ขยายทั้งหมด", "ย่อทั้งหมด",
           "คัดลอกเอกสาร", "คัดลอกฟิลด์สคีมาเป็น Markdown แล้ว",
           "คัดลอกฟิลด์สคีมาไม่สำเร็จ"],
        r="คำอธิบาย",
        c=["รีเฟรชจาก OpenAPI",
           "รีเฟรชคอลเลกชันแล้ว (เพิ่ม {added} รายการ, อัปเดต {updated} รายการ, {removed} รายการไม่อยู่ในสเปกแล้ว)",
           "ไม่สามารถเข้าถึง URL ของเอกสาร OpenAPI",
           "ไม่สามารถแยกวิเคราะห์เอกสาร OpenAPI ได้",
           "คอลเลกชันนี้ไม่มีแหล่ง OpenAPI ให้รีเฟรช",
           "ไม่มีคอลเลกชันนี้แล้ว",
           "เชื่อมต่อแหล่ง OpenAPI", "URL ของเอกสาร OpenAPI",
           "คอลเลกชันนี้ยังไม่ได้บันทึกแหล่ง OpenAPI กรอก URL ของเอกสารหนึ่งครั้งแล้วระบบจะจำไว้สำหรับการรีเฟรชครั้งถัดไป",
           "ตัวอย่าง: https://example.com/openapi.json", "กรอก URL http(s) ที่ถูกต้อง"],
    ),
    "tr": dict(
        s=["Şema Alanları", "Alan", "Tür", "Zorunlu", "Açıklama", "Tümünü genişlet",
           "Tümünü daralt", "Dokümanı kopyala", "Şema alanları Markdown olarak kopyalandı",
           "Şema alanları kopyalanamadı"],
        r="Açıklama",
        c=["OpenAPI'den yenile",
           "Koleksiyon yenilendi ({added} eklendi, {updated} güncellendi, {removed} artık spesifikasyonda değil)",
           "OpenAPI belgesinin URL'sine ulaşılamadı",
           "OpenAPI belgesi çözümlenemedi",
           "Bu koleksiyonun yenilenecek bir OpenAPI kaynağı yok",
           "Koleksiyon artık mevcut değil",
           "OpenAPI kaynağını bağla", "OpenAPI belgesi URL'si",
           "Bu koleksiyonda kayıtlı bir OpenAPI kaynağı yok. Belge URL'sini bir kez girin; sonraki yenilemeler için hatırlanacak.",
           "Örnek: https://example.com/openapi.json", "Geçerli bir http(s) URL'si girin"],
    ),
    "tw": dict(
        s=["Schema 欄位", "欄位", "型別", "必填", "說明", "展開全部", "收合全部",
           "複製文件", "已將 Schema 欄位複製為 Markdown", "複製 Schema 欄位失敗"],
        r="說明",
        c=["從 OpenAPI 重新整理",
           "集合已重新整理（新增 {added} 個、更新 {updated} 個、{removed} 個已不在 spec 中）",
           "無法連線到該 OpenAPI 文件網址",
           "OpenAPI 文件解析失敗",
           "此集合沒有可重新整理的 OpenAPI 來源",
           "集合已不存在",
           "連結 OpenAPI 來源", "OpenAPI 文件網址",
           "此集合尚未記錄 OpenAPI 來源。填入一次文件網址後會記住，之後可直接重新整理。",
           "範例：https://example.com/openapi.json", "請輸入有效的 http(s) 網址"],
    ),
    "uk": dict(
        s=["Поля схеми", "Поле", "Тип", "Обов'язково", "Опис", "Розгорнути все",
           "Згорнути все", "Копіювати документацію", "Поля схеми скопійовано як Markdown",
           "Не вдалося скопіювати поля схеми"],
        r="Опис",
        c=["Оновити з OpenAPI",
           "Колекцію оновлено (додано {added}, оновлено {updated}, {removed} більше немає в специфікації)",
           "Не вдалося отримати доступ до URL документа OpenAPI",
           "Не вдалося розібрати документ OpenAPI",
           "Ця колекція не має джерела OpenAPI для оновлення",
           "Колекція більше не існує",
           "Підключити джерело OpenAPI", "URL документа OpenAPI",
           "У цієї колекції не записано джерело OpenAPI. Вкажіть URL документа один раз, і він запам'ятається для наступних оновлень.",
           "Приклад: https://example.com/openapi.json", "Введіть коректний URL http(s)"],
    ),
    "vi": dict(
        s=["Trường lược đồ", "Trường", "Kiểu", "Bắt buộc", "Mô tả", "Mở rộng tất cả",
           "Thu gọn tất cả", "Sao chép tài liệu",
           "Đã sao chép trường lược đồ dưới dạng Markdown",
           "Không sao chép được trường lược đồ"],
        r="Mô tả",
        c=["Làm mới từ OpenAPI",
           "Bộ sưu tập đã được làm mới ({added} thêm mới, {updated} cập nhật, {removed} không còn trong đặc tả)",
           "Không thể truy cập URL tài liệu OpenAPI",
           "Không thể phân tích tài liệu OpenAPI",
           "Bộ sưu tập này không có nguồn OpenAPI để làm mới",
           "Bộ sưu tập không còn tồn tại",
           "Kết nối nguồn OpenAPI", "URL tài liệu OpenAPI",
           "Bộ sưu tập này chưa ghi lại nguồn OpenAPI. Nhập URL tài liệu một lần, hệ thống sẽ ghi nhớ cho các lần làm mới sau.",
           "Ví dụ: https://example.com/openapi.json", "Nhập URL http(s) hợp lệ"],
    ),
}

SCHEMA_POS = dict(
    zip(
        ["title", "field", "type", "required", "description", "expand", "collapse",
         "copy", "copied", "copy_failed"],
        range(10),
    )
)

COLL_POS = dict(zip(COLL_ORDER, range(len(COLL_ORDER))))


def load(path):
    with open(path, encoding="utf-8") as handle:
        return json.load(handle, object_pairs_hook=collections.OrderedDict)


def detect_indent(path):
    """Locales are hand-maintained: most use 2 spaces, a few use 4."""
    with open(path, encoding="utf-8") as handle:
        for line in handle.readlines()[1:6]:
            stripped = line.lstrip(" ")
            if stripped.startswith('"'):
                return len(line) - len(stripped)
    return 2


def dump(path, data):
    # Read the indentation before truncating the file.
    indent = detect_indent(path)

    with open(path, "w", encoding="utf-8", newline="\n") as handle:
        handle.write(json.dumps(data, ensure_ascii=False, indent=indent))
        handle.write("\n")


def main():
    report = []
    for code, entry in DATA.items():
        # `cn.json` mixes 2- and 4-space blocks; rewriting it would reformat
        # ~130 unrelated lines, so it is patched by hand instead.
        if code == "cn":
            continue

        path = os.path.join(LOCALES_DIR, code + ".json")
        if not os.path.exists(path):
            print("missing locale file:", code)
            continue

        doc = load(path)
        added = []
        kept = []

        documentation = doc.setdefault("documentation", collections.OrderedDict())

        schema_fields = documentation.get("schema_fields")
        if not isinstance(schema_fields, dict):
            schema_fields = collections.OrderedDict()
            documentation["schema_fields"] = schema_fields

        for key in SCHEMA_ORDER:
            value = entry["s"][SCHEMA_POS[key]]
            if key in schema_fields:
                kept.append("documentation.schema_fields." + key)
            else:
                schema_fields[key] = value
                added.append("documentation.schema_fields." + key)

        response = documentation.get("response")
        if not isinstance(response, dict):
            response = collections.OrderedDict()
            documentation["response"] = response
        if "description" in response:
            kept.append("documentation.response.description")
        else:
            response["description"] = entry["r"]
            added.append("documentation.response.description")

        collection = doc.setdefault("collection", collections.OrderedDict())
        for index, key in enumerate(COLL_ORDER):
            if key in collection:
                kept.append("collection." + key)
            else:
                collection[key] = entry["c"][COLL_POS[key]]
                added.append("collection." + key)

        dump(path, doc)
        report.append((code, len(added), len(kept)))

    for code, added, kept in report:
        print("%-6s added=%-2d kept=%d" % (code, added, kept))


if __name__ == "__main__":
    sys.exit(main())
