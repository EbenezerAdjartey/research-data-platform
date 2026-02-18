Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
}
"@

$procs = Get-Process | Where-Object { $_.MainWindowTitle -like '*localhost*' -or $_.MainWindowTitle -like '*Chrome*' -or $_.MainWindowTitle -like '*Edge*' -or $_.MainWindowTitle -like '*Firefox*' -or $_.MainWindowTitle -like '*Research*' -or $_.MainWindowTitle -like '*Sign*' }
foreach ($p in $procs) {
    if ($p.MainWindowHandle -ne 0) {
        [Win32]::ShowWindow($p.MainWindowHandle, 9) | Out-Null
        [Win32]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
        Write-Output "Focused: $($p.MainWindowTitle)"
    }
}
Start-Sleep -Seconds 2
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bitmap.Save("C:\Users\HP\Desktop\Projects\New One\screenshot2.png")
$graphics.Dispose()
$bitmap.Dispose()
Write-Output "Screenshot saved"
