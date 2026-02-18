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

$proc = Get-Process | Where-Object { $_.MainWindowTitle -like '*Research Data*' } | Select-Object -First 1
if ($proc) {
    [Win32]::ShowWindow($proc.MainWindowHandle, 3) | Out-Null
    [Win32]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
    Write-Output "Focused: $($proc.MainWindowTitle)"
}
Start-Sleep -Seconds 3
$screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($screen.Width, $screen.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, $screen.Size)
$bitmap.Save("C:\Users\HP\Desktop\Projects\New One\screenshot2.png")
$graphics.Dispose()
$bitmap.Dispose()
Write-Output "Screenshot saved"
