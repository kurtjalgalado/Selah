import json
import re

TAGALOG_WORDS = {
    'ang', 'ng', 'sa', 'ako', 'ikaw', 'siya', 'kami', 'tayo', 'diyos', 'panginoon',
    'dakila', 'puso', 'buhay', 'tapat', 'awit', 'pumuri', 'samba', 'koro', 'kanya',
    'bayan', 'lahat', 'harapan', 'luwalhati', 'kay', 'mo', 'ko', 'ito', 'natin',
    'nito', 'amin', 'mga', 'din', 'rin', 'pag-ibig', 'ligaya', 'kagalakan',
    'sama-sama', 'halina', 'tunay', 'walang', 'hesus', 'haring', 'sumasamba',
    'kabutihan', 'katapatan', 'biyaya', 'kapangyarihan', 'o', 'na', 'pa', 'kailanman'
}

FAST_KEYWORDS = {
    'praise', 'dance', 'sing', 'joy', 'shout', 'clap', 'celebrate', 'victory',
    'glory', 'rock', 'fast', 'jump', 'alive', 'happy', 'run', 'river', 'freedom',
    'pumuri', 'masaya', 'sumayaw', 'gumalaw', 'magdiwang', 'sigaw', 'ipagdiwang',
    'galak', 'palakpak', 'taas', 'sayaw', 'awitan', 'gising', 'bangon', 'sama-sama',
    'tayo\'y', 'rejoice', 'triumph', 'mighty', 'lion', 'shout to the lord', 'great is the lord',
    'hallelujah', 'trading my sorrows', 'everyday', 'sing sing sing'
}

KNOWN_FAST_TITLES = {
    'sama-sama', 'let there be praise', 'celebrate jesus', 'i will sing',
    'trading my sorrows', 'everyday', 'my redeemer lives', 'god is good all the time',
    'this is the day', 'i am free', 'sing sing sing', 'hosanna', 'happy day',
    'salubungin ng papuri', 'o kay ganda', 'magdiwang', 'tayo ay mag-awitan',
    'siya ay buhay', 'walang katulad', 'ipagdiwang ang tagumpay', 'halina\'t purihin ang diyos',
    'halina at magpuri', 'sumayaw sa galak', 'magpupuri'
}

def detect_language(title, lyrics):
    text = (title + " " + lyrics).lower()
    words = re.findall(r'\b[a-z\']+\b', text)
    tagalog_count = sum(1 for w in words if w in TAGALOG_WORDS)
    english_count = len(words) - tagalog_count
    
    if tagalog_count >= 3 or (len(words) > 0 and (tagalog_count / len(words)) > 0.08):
        return "Tagalog"
    return "English"

def detect_tempo_and_category(title, lyrics):
    text = (title + " " + lyrics).lower()
    
    for fast_title in KNOWN_FAST_TITLES:
        if fast_title in text:
            return "Fast", 120
            
    words = re.findall(r'\b[a-z\']+\b', text)
    fast_matches = sum(1 for w in words if w in FAST_KEYWORDS)
    
    # Check exclamations or fast indicator words in title
    title_lower = title.lower()
    if any(k in title_lower for k in ['praise', 'dance', 'shout', 'celebrate', 'sing', 'sayaw', 'diwang', 'galak', 'papuri', 'sama-sama']):
        fast_matches += 3

    if fast_matches >= 3:
        return "Fast", 120
    else:
        return "Slow", 70

def main():
    file_path = 'src/db/scraped_songs.json'
    with open(file_path, 'r', encoding='utf-8') as f:
        songs = json.load(f)

    stats = {'Tagalog': 0, 'English': 0, 'Fast': 0, 'Slow': 0}
    combo_stats = {'Tagalog Fast': 0, 'Tagalog Slow': 0, 'English Fast': 0, 'English Slow': 0}

    for song in songs:
        lang = detect_language(song.get('title', ''), song.get('lyrics', ''))
        cat, tempo = detect_tempo_and_category(song.get('title', ''), song.get('lyrics', ''))
        
        song['category'] = cat
        song['language'] = lang
        song['tempo'] = tempo
        song['tags'] = [cat, lang]

        stats[lang] += 1
        stats[cat] += 1
        combo_stats[f"{lang} {cat}"] += 1

    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(songs, f, indent=2, ensure_ascii=False)

    print("Retagging complete!")
    print("Language breakdown:", {k: v for k, v in stats.items() if k in ['Tagalog', 'English']})
    print("Tempo breakdown:", {k: v for k, v in stats.items() if k in ['Fast', 'Slow']})
    print("Combination breakdown:", combo_stats)

if __name__ == '__main__':
    main()
