import re

# store.js — need BOTH: our import AND master's comment
store_path = '/private/tmp/todos-api-task-153-storage-keys/client/modules/store.js'
with open(store_path) as f:
    content = f.read()

# The conflict block: our line is the import, master's line is the comment
# We want: import line THEN comment line
conflict = re.search(
    r'<<<<<<< HEAD\n(.*?)\n=======\n(.*?)\n>>>>>>> origin/master\n',
    content, re.DOTALL
)
if conflict:
    ours = conflict.group(1).strip()    # import { STORAGE_KEYS } ...
    theirs = conflict.group(2).strip()  # // Runtime UI state module ...
    replacement = ours + '\n' + theirs + '\n'
    content = content[:conflict.start()] + replacement + content[conflict.end():]
    with open(store_path, 'w') as f:
        f.write(content)
    print(f'store.js resolved: kept both lines')
else:
    print('store.js: no conflict found')

# BRIEF.md and next-enhancements.md — take master's version (strikethrough = resolved)
for path in [
    '/private/tmp/todos-api-task-153-storage-keys/docs/memory/brief/BRIEF.md',
    '/private/tmp/todos-api-task-153-storage-keys/docs/next-enhancements.md',
]:
    with open(path) as f:
        lines = f.readlines()
    resolved = []
    i = 0
    while i < len(lines):
        if lines[i].startswith('<<<<<<<'):
            ours, theirs = [], []
            i += 1
            while i < len(lines) and not lines[i].startswith('======='):
                ours.append(lines[i]); i += 1
            i += 1
            while i < len(lines) and not lines[i].startswith('>>>>>>>'):
                theirs.append(lines[i]); i += 1
            i += 1
            resolved.extend(theirs)  # take master's
        else:
            resolved.append(lines[i]); i += 1
    with open(path, 'w') as f:
        f.writelines(resolved)
    print(f'{path.split("/")[-1]} resolved: took master version')

# Verify
for path in [store_path,
    '/private/tmp/todos-api-task-153-storage-keys/docs/memory/brief/BRIEF.md',
    '/private/tmp/todos-api-task-153-storage-keys/docs/next-enhancements.md']:
    content = open(path).read()
    markers = [m for m in ['<<<<<<<', '=======', '>>>>>>>'] if m in content]
    print(f'{path.split("/")[-1]}: {"CONFLICT MARKERS REMAIN" if markers else "CLEAN"}')
