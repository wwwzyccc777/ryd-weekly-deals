import pathlib,zipfile,json
p=pathlib.Path(__file__).resolve().parent.parent
(p/'work').mkdir(exist_ok=True)
target=p/'work/public-source.zip'
excluded={'verify-hosted.mjs'}
with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED,strict_timestamps=False) as z:
 for directory in ['src','data','scripts','docs','.github']:
  for file in sorted((p/directory).rglob('*')):
   if file.is_file() and file.name not in excluded:
    z.write(file,file.relative_to(p).as_posix())
 for file in ['README.md','UPDATES.md','LICENSE','package.json','Start.cmd','.gitignore','CONTRIBUTING.md','CHANGELOG.md','wrangler.jsonc']:
  z.write(p/file,file)
 z.writestr('.openai/hosting.json',json.dumps({'d1':None,'r2':'BUCKET'}))
print('Packaged shareable source without project identity or private keys.')
