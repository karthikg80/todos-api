path = '/private/tmp/todos-api-task-153-storage-keys/client/modules/store.js'
with open(path) as f:
    content = f.read()
markers = []
for m in ['<<<<<<<', '>>>>>>>']:
    if m in content:
        markers.append(m)
# Check for ======= that isn't part of the header decoration
import re
for match in re.finditer(r'^={7}$', content, re.MULTILINE):
    markers.append(f'standalone ======= at pos {match.start()}')
print('Actual conflict markers:', markers if markers else 'NONE')
print('Has STORAGE_KEYS import:', 'import { STORAGE_KEYS }' in content)
print('Has runtime comment:', 'Runtime UI state module' in content)
