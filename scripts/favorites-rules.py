from pathlib import Path
p = Path('firestore.rules')
t = p.read_text(encoding='utf-8')
block = '''
    match /tracksideFavorites/{id} {
      allow read: if true;
      allow create, update, delete: if isBootstrapAdmin() || isAdmin();
    }
'''
if 'match /tracksideFavorites/' not in t:
    t = t.replace('    match /accounts/{uid} {', block + '    match /accounts/{uid} {', 1)
    p.write_text(t, encoding='utf-8')
    print('rules added')
else:
    print('rules exist')
