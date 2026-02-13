const fs = require('fs');
const path = require('path');
const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');

const BUNDLE_PHASE_NAME = 'Bundle React Native code and images';
const BUNDLE_SCRIPT_NEEDLE =
  '`"$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'"`';
const BUNDLE_SCRIPT_PATCH =
  'RN_XCODE_SCRIPT_PATH="$("$NODE_BINARY" --print "require(\'path\').dirname(require.resolve(\'react-native/package.json\')) + \'/scripts/react-native-xcode.sh\'")"\\n"$RN_XCODE_SCRIPT_PATH"';

const PODFILE_MARKER = '# Path-safe script patch for folders containing spaces';
const PODFILE_PATCH = `\n    ${PODFILE_MARKER}\n    installer.pods_project.targets.each do |target|\n      next unless target.name == 'EXConstants'\n\n      target.shell_script_build_phases.each do |phase|\n        next unless phase.name&.include?('Generate app.config')\n\n        phase.shell_script = 'bash -l -c "\\\\"$PODS_TARGET_SRCROOT/../scripts/get-app-config-ios.sh\\\\""'\n      end\n    end\n\n    installer.pods_project.save`;

function patchBundleBuildPhase(config) {
  return withXcodeProject(config, (cfg) => {
    const phases = cfg.modResults.hash.project.objects.PBXShellScriptBuildPhase || {};

    for (const key of Object.keys(phases)) {
      const phase = phases[key];
      if (!phase || typeof phase !== 'object') continue;
      if (!phase.name || !String(phase.name).includes(BUNDLE_PHASE_NAME)) continue;
      if (!phase.shellScript || !String(phase.shellScript).includes(BUNDLE_SCRIPT_NEEDLE))
        continue;

      phase.shellScript = String(phase.shellScript).replace(
        BUNDLE_SCRIPT_NEEDLE,
        BUNDLE_SCRIPT_PATCH
      );
    }

    return cfg;
  });
}

function patchPodfile(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      if (!fs.existsSync(podfilePath)) {
        return cfg;
      }

      let content = fs.readFileSync(podfilePath, 'utf8');
      if (content.includes(PODFILE_MARKER)) {
        return cfg;
      }

      const needle = `    )\n  end`;
      if (content.includes(needle)) {
        content = content.replace(needle, `    )${PODFILE_PATCH}\n  end`);
        fs.writeFileSync(podfilePath, content);
      }

      return cfg;
    },
  ]);
}

module.exports = function withPathSafeIosScripts(config) {
  config = patchBundleBuildPhase(config);
  config = patchPodfile(config);
  return config;
};
