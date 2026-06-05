import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import * as core from "@actions/core";
import * as tc from "@actions/tool-cache";

type Platform = "linux" | "darwin" | "windows";
type Architecture = "amd64" | "arm64";
type ArchiveExtension = ".zip" | ".tar.gz";

const getPlatform = (): Platform => {
  switch (os.platform()) {
    case "linux":
      return "linux";
    case "darwin":
      return "darwin";
    case "win32":
      return "windows";
    default:
      core.setFailed("Unsupported Platform");
      return process.exit();
  }
};

const getArchitecture = (): Architecture => {
  switch (os.arch()) {
    case "x64":
      return "amd64";
    case "arm64":
      return "arm64";
    default:
      core.setFailed("Unsupported Architecture");
      return process.exit();
  }
};

const getArchiveExtension = (): ArchiveExtension => {
  switch (os.platform()) {
    case "win32":
      return ".zip";
    case "linux":
    case "darwin":
      return ".tar.gz";
    default:
      core.setFailed("Unsupported Platform");
      return process.exit();
  }
};

const isExtremelyLegacyRelease = (version: string): boolean => {
  const [major] = version
    .split(".")
    .slice(0, 1)
    .map((s) => parseInt(s, 10));
  return major === 0;
};

const getApplicationName = (version: string): string =>
  isExtremelyLegacyRelease(version) ? "yaml" : "yq";

const isLegacyRelease = (version: string): boolean => {
  const parts = version.split(".").map((s) => parseInt(s, 10));
  const major = parts[0] ?? 0;
  const minor = parts[1] ?? 0;
  return major < 4 || (major === 4 && minor < 1);
};

const hasArchive = (version: string): boolean => !isLegacyRelease(version);

const getExecutableExtension = (): string => {
  switch (os.platform()) {
    case "win32":
      return ".exe";
    case "linux":
    case "darwin":
      return "";
    default:
      core.setFailed("Unsupported Platform");
      return process.exit();
  }
};

const getVersionPrefix = (version: string): string =>
  isLegacyRelease(version) ? "" : "v";

const getURL = (version: string): string => {
  const platform = getPlatform();
  const arch = getArchitecture();
  const extension = hasArchive(version)
    ? getArchiveExtension()
    : getExecutableExtension();
  const prefix = getVersionPrefix(version);
  const name = getApplicationName(version);
  return `https://github.com/mikefarah/yq/releases/download/${prefix}${version}/${name}_${platform}_${arch}${extension}`;
};

const extract = (archive: string): Promise<string> => {
  switch (getArchiveExtension()) {
    case ".zip":
      return tc.extractZip(archive);
    case ".tar.gz":
      return tc.extractTar(archive);
    default:
      core.setFailed("Unsupported Archive Type");
      return process.exit();
  }
};

const cache =
  (fn: (version: string) => Promise<string>) =>
  async (version: string): Promise<string> => {
    const cached = tc.find("yq", version);
    if (cached !== "") return cached;
    const executable = await fn(version);
    return tc.cacheFile(
      executable,
      `yq${getExecutableExtension()}`,
      "yq",
      version,
    );
  };

const chmod = async (file: string): Promise<string> => {
  const { mode } = await fs.lstat(file);
  const newMode = mode | 0o111;
  await fs.chmod(file, newMode);
  return file;
};

const getTool = cache(async (version: string): Promise<string> => {
  const url = getURL(version);
  core.debug(JSON.stringify({ url }));
  const download = await tc.downloadTool(url);
  if (!hasArchive(version)) return chmod(download);
  const folder = await extract(download);
  return chmod(
    path.resolve(
      folder,
      `yq_${getPlatform()}_${getArchitecture()}${getExecutableExtension()}`,
    ),
  );
});

(async () => {
  const version = core.getInput("yq-version", { required: true });
  const tool = await getTool(version);
  core.addPath(tool);
})().catch(core.setFailed);
