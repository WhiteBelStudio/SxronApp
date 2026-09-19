using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

internal static class SxronLauncher
{
    private const string Owner = "WhiteBelStudio";
    private const string Repo = "SxronApp";
    private const string InstallDirName = "sxron-marketplace";

    private static string InstallDir
    {
        get
        {
            return Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "Programs",
                InstallDirName
            );
        }
    }

    private static string AppExe
    {
        get { return Path.Combine(InstallDir, "SXRON Marketplace.exe"); }
    }

    private static string VersionFile
    {
        get { return Path.Combine(InstallDir, "current-version.txt"); }
    }

    private static string UpdateDir
    {
        get { return Path.Combine(Path.GetTempPath(), "SXRON Launcher"); }
    }

    [STAThread]
    private static int Main(string[] args)
    {
        try
        {
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;

            if (Array.Exists(args, a => string.Equals(a, "--smoke", StringComparison.OrdinalIgnoreCase)))
                return 0;

            Directory.CreateDirectory(InstallDir);

            string installedVersion = ReadVersion();
            string latestVersion = TryGetLatestVersion();

            if (!string.IsNullOrWhiteSpace(latestVersion) && Compare(latestVersion, installedVersion) > 0)
            {
                UpdateTo(latestVersion);
            }

            if (!File.Exists(AppExe))
                throw new FileNotFoundException("SXRON Marketplace.exe не найден.", AppExe);

            Process.Start(new ProcessStartInfo
            {
                FileName = AppExe,
                WorkingDirectory = InstallDir,
                UseShellExecute = true
            });

            return 0;
        }
        catch (Exception ex)
        {
            try
            {
                string logDir = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "sxron-marketplace"
                );
                Directory.CreateDirectory(logDir);
                File.WriteAllText(
                    Path.Combine(logDir, "launcher.log"),
                    DateTime.Now.ToString("O") + Environment.NewLine + ex,
                    Encoding.UTF8
                );
            }
            catch { }

            try
            {
                MessageBox.Show(
                    "Не удалось запустить SXRON Marketplace.\n\n" + ex.Message,
                    "SXRON Launcher",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
            catch { }

            return 1;
        }
    }

    private static string ReadVersion()
    {
        try
        {
            if (!File.Exists(VersionFile))
                return "0.0.0";

            return File.ReadAllText(VersionFile).Trim();
        }
        catch
        {
            return "0.0.0";
        }
    }

    private static string TryGetLatestVersion()
    {
        try
        {
            using (var client = new WebClient())
            {
                client.Headers[HttpRequestHeader.UserAgent] = "SXRON-Launcher/1.3.7";
                string json = client.DownloadString(
                    "https://api.github.com/repos/" + Owner + "/" + Repo + "/releases/latest"
                );

                Match match = Regex.Match(
                    json,
                    @"""tag_name""\s*:\s*""v?(\d+\.\d+\.\d+)""",
                    RegexOptions.IgnoreCase
                );

                return match.Success ? match.Groups[1].Value : null;
            }
        }
        catch
        {
            // Network failure must never prevent an already-installed SXRON from opening.
            return null;
        }
    }

    private static void UpdateTo(string version)
    {
        Directory.CreateDirectory(UpdateDir);

        string installer = Path.Combine(
            UpdateDir,
            "SXRON-Marketplace-Setup-" + version + "-x64.exe"
        );

        string url =
            "https://github.com/" + Owner + "/" + Repo +
            "/releases/download/v" + version +
            "/SXRON-Marketplace-Setup-" + version + "-x64.exe";

        using (var client = new WebClient())
        {
            client.Headers[HttpRequestHeader.UserAgent] = "SXRON-Launcher/1.3.7";
            client.DownloadFile(url, installer);
        }

        using (Process process = Process.Start(new ProcessStartInfo
        {
            FileName = installer,
            Arguments = "/S /NCRC /D=\"" + InstallDir + "\"",
            UseShellExecute = true,
            WorkingDirectory = UpdateDir
        }))
        {
            if (process != null)
                process.WaitForExit();
        }

        try
        {
            if (File.Exists(installer))
                File.Delete(installer);
        }
        catch { }
    }

    private static int Compare(string left, string right)
    {
        Version a;
        Version b;

        if (!Version.TryParse(left, out a))
            a = new Version(0, 0, 0);

        if (!Version.TryParse(right, out b))
            b = new Version(0, 0, 0);

        return a.CompareTo(b);
    }
}
