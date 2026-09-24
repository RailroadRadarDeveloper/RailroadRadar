from pathlib import Path

def patch(path):
    p = Path(path)
    t = p.read_text(encoding='utf-8')
    t = t.replace('<p class="mytrips-guest-kicker">By RailroadRadar</p>\n        ', '')
    t = t.replace('>Sign in to open MyTrips</button>', '>Get Started</button>')
    old_open = '''    function openSignupPrompt(force) {
      if (currentUser || (auth && auth.currentUser)) return;'''
    new_open = '''    function openSignupPrompt(force) {
      if (typeof rrIsMyTripsPage === 'function' && rrIsMyTripsPage()) return;
      if (currentUser || (auth && auth.currentUser)) return;'''
    if old_open in t:
        t = t.replace(old_open, new_open, 1)
    old_sched = '''    function scheduleSignupPrompt() {
      if (signupPromptTimer) clearTimeout(signupPromptTimer);
      signupPromptTimer = null;
      if (currentUser || (auth && auth.currentUser) || isSignupPromptDismissed()) {'''
    new_sched = '''    function scheduleSignupPrompt() {
      if (signupPromptTimer) clearTimeout(signupPromptTimer);
      signupPromptTimer = null;
      if (typeof rrIsMyTripsPage === 'function' && rrIsMyTripsPage()) {
        closeSignupPrompt();
        return;
      }
      if (currentUser || (auth && auth.currentUser) || isSignupPromptDismissed()) {'''
    if old_sched in t:
        t = t.replace(old_sched, new_sched, 1)
    p.write_text(t, encoding='utf-8')
    print('patched', path)
    print(' kicker gone', 'By RailroadRadar</p>' not in t)
    print(' get started', '>Get Started</button>' in t)

patch('index.html')
patch('mytrips/index.html')
