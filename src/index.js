const os = require('os');
const path = require('path');
const fs = require('fs');
const core = require('@actions/core');
const tc = require('@actions/tool-cache');
const io = require('@actions/io');

const getPlatform = () => {
  switch (os.platform()) {
    case 'linux': return 'linux';
    case 'darwin': return 'darwin';
    case 'win32': return 'windows';
    default:
      core.setFailed('Unsupported Platform');
      return process.exit();
  }
};

const getArchitecture = () => {
  switch (os.arch()) {
    case 'x64': return 'amd64';
    default:
      core.setFailed('Unsupported Architecture');
      return process.exit();
  }
};

const getArchiveExtension = () => {
  switch (os.platform()) {
    case 'win32': return '.zip';
    case 'linux':
    case 'darwin':
      return '.tar.gz';
    default:
      core.setFailed('Unsupported Platform');
      return process.exit();
  }
};

const isLegacyRelease = (version) => {
  const [major, minor] = version
    .split('.')
    .slice(0, 2)
    .map((s) => parseInt(s, 10));
  return major < 4 || (major === 4 && minor < 1);
};

const hasArchive = (version) => !isLegacyRelease(version);

const getExecutableExtension = () => {
  switch (os.platform()) {
    case 'win32': return '.exe';
    case 'linux':
    case 'darwin':
      return '';
    default:
      core.setFailed('Unsupported Platform');
      return process.exit();
  }
};

const getVersionPrefix = (version) => (isLegacyRelease(version) ? '' : 'v');

const getURL = (version) => {
  const platform = getPlatform();
  const arch = getArchitecture();
  const extension = hasArchive(version) ? getArchiveExtension() : getExecutableExtension();
  const prefix = getVersionPrefix(version);
  return `https://github.com/mikefarah/yq/releases/download/${prefix}${version}/yq_${platform}_${arch}${extension}`;
};

const extract = (archive) => {
  switch (getArchiveExtension()) {
    case '.zip': return tc.extractZip(archive);
    case '.tar.gz': return tc.extractTar(archive);
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
  core.debug(fs.readdirSync(archive));
  const folder = await extract(archive);
  core.debug(fs.readdirSync(folder));
  await io.mv(
    path.resolve(folder, `yq_${getPlatform()}_${getArchitecture()}${getExecutableExtension()}`),
    path.resolve(folder, 'yq'),
  );
  return folder;
});

(async () => {
  const version = core.getInput('yq-version', { required: true });
  const tool = await getTool(version);
  core.addPath(tool);
})().catch(core.setFailed);
