const os = require('os');
const core = require('@actions/core');
const tc = require('@actions/tool-cache');

const getPlatform = () => {
  switch (os.platform()) {
    case 'linux': return 'Linux';
    case 'darwin': return 'Darwin';
    case 'win32': return 'Windows';
    default:
      core.setFailed('Unsupported Platform');
      return process.exit();
  }
};

const getArchitecture = () => {
  switch (os.arch()) {
    case 'x64': return 'x86_64';
    default:
      core.setFailed('Unsupported Architecture');
      return process.exit();
  }
};

const getArchiveExtension = () => {
  switch (os.platform()) {
    case 'win32': return 'zip';
    case 'linux':
    case 'darwin':
      return 'tar.gz';
    default:
      core.setFailed('Unsupported Platform');
      return process.exit();
  }
};

const getURL = (version) => {
  const platform = getPlatform();
  const arch = getArchitecture();
  const extension = getArchiveExtension();
  return `https://github.com/mikefarah/yq/releases/download/v${version}/yq_${platform}_${arch}.${extension}`
};

const extract = (archive) => {
  switch (getArchiveExtension()) {
    case 'zip': return tc.extractZip(archive);
    case 'tar.gz': return tc.extractTar(archive);
    default:
      core.setFailed('Unsupported Archive Type');
      return process.exit();
  }
};

const cache = (fn) => async (version) => {
  const cached = tc.find('yq', version);
  if (cached !== '') return cached;
  const folder = await fn(version);
  return tc.cacheDir(folder, 'yq', version);
};

const getTool = cache(async (version) => {
  const url = getURL(version);
  const archive = await tc.downloadTool(url);
  return extract(archive);
});

(async () => {
  const version = core.getInput('yq-version', { required: true });
  const tool = await getTool(version);
  core.addPath(tool);
})().catch(core.setFailed);
