from pathlib import Path

LATE = '''
<script>
(function() {
  function go(e) {
    var t = e.target && e.target.closest && e.target.closest('#btn-google-signin, #signup-prompt-signin, #btn-account-signin-panel, #mytrips-guest-signin');
    if (!t) return;
    e.preventDefault();
    e.stopPropagation();
    if (typeof signInWithGoogle === 'function') signInWithGoogle();
    else if (typeof requestGoogleSignIn === 'function') requestGoogleSignIn();
  }
  document.addEventListener('click', go, true);
})();
</script>
'''

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace(
        'btnIn.addEventListener(\'click\', function(e) {\n          if (e) { e.preventDefault(); e.stopPropagation(); }\n          requestGoogleSignIn();\n        });',
        'btnIn.addEventListener(\'click\', function(e) {\n          if (e) { e.preventDefault(); e.stopPropagation(); }\n          if (typeof signInWithGoogle === \'function\') signInWithGoogle();\n          else requestGoogleSignIn();\n        });',
        1,
    )
    if 'id="rr-login-direct"' not in t:
        t = t.replace('</body>', LATE.replace('<script>', '<script id="rr-login-direct">', 1) + '\n</body>', 1)
        print('late', path)
    p.write_text(t, encoding='utf-8')
    print('done', path)

patch('index.html')
patch('mytrips/index.html')
