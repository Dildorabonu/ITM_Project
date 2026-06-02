using System.Text;

namespace Application.Helpers;

// Mahsulot nomlarini "kanonik" ko'rinishga keltiradi — shunda bir xil mahsulot
// turli yozuvda kiritilsa ham (kirill/lotin, katta-kichik harf, ortiqcha probel,
// tutuq/tinish belgilari) bir xil natija beradi va dublikat sifatida aniqlanadi.
//
// Misol: "Болт М8", "Bolt M8", "bolt  m-8" → hammasi "boltm8".
public static class TextNormalizer
{
    // O'zbek kirill harflarini lotinga o'tkazish jadvali (kichik harflar uchun;
    // kirish avval ToLowerInvariant qilinadi).
    private static readonly Dictionary<char, string> CyrillicToLatin = new()
    {
        ['а'] = "a", ['б'] = "b", ['в'] = "v", ['г'] = "g", ['ғ'] = "g", ['д'] = "d",
        ['е'] = "e", ['ё'] = "yo", ['ж'] = "j", ['з'] = "z", ['и'] = "i", ['й'] = "y",
        ['к'] = "k", ['қ'] = "q", ['л'] = "l", ['м'] = "m", ['н'] = "n", ['о'] = "o",
        ['п'] = "p", ['р'] = "r", ['с'] = "s", ['т'] = "t", ['у'] = "u", ['ў'] = "o",
        ['ф'] = "f", ['х'] = "x", ['ҳ'] = "h", ['ц'] = "ts", ['ч'] = "ch", ['ш'] = "sh",
        ['щ'] = "sh", ['ъ'] = "", ['ы'] = "i", ['ь'] = "", ['э'] = "e", ['ю'] = "yu",
        ['я'] = "ya",
    };

    public static string Normalize(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
            return string.Empty;

        var lower = input.Trim().ToLowerInvariant();
        var sb = new StringBuilder(lower.Length);

        foreach (var ch in lower)
        {
            if (CyrillicToLatin.TryGetValue(ch, out var rep))
                sb.Append(rep);
            else if (char.IsLetterOrDigit(ch))
                sb.Append(ch);
            // Qolgan belgilar (probel, ', ʻ, -, ., / va h.k.) tashlab yuboriladi.
        }

        return sb.ToString();
    }

    // pg_trgm similarity() ga mos keladigan C# implementatsiyasi — import paytida
    // butun faylni bitta so'rovda (DB ga har qator uchun alohida bormasdan) tekshirish uchun.
    // Kirish satrlari allaqachon Normalize() qilingan bo'lishi kutiladi.
    public static double TrigramSimilarity(string normA, string normB)
    {
        if (normA.Length == 0 && normB.Length == 0) return 1d;

        var a = Trigrams(normA);
        var b = Trigrams(normB);
        if (a.Count == 0 || b.Count == 0) return 0d;

        var intersection = 0;
        foreach (var t in a)
            if (b.Contains(t)) intersection++;

        var union = a.Count + b.Count - intersection;
        return union == 0 ? 0d : (double)intersection / union;
    }

    // pg_trgm kabi: so'zni 2 ta oldingi + 1 ta keyingi probel bilan to'ldirib,
    // 3 belgili oynalarni (distinct) ajratadi. "boltm8" → {"  b"," bo","bol",...,"m8 "}.
    private static HashSet<string> Trigrams(string s)
    {
        var padded = "  " + s + " ";
        var set = new HashSet<string>();
        for (var i = 0; i + 3 <= padded.Length; i++)
            set.Add(padded.Substring(i, 3));
        return set;
    }
}
