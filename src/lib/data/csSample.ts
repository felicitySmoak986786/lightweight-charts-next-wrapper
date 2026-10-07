import type { CsIndicatorMetadata } from '@/lib/chart';

/** Metadata for the bundled C# sample indicator. */
export const csSampleMetadata: CsIndicatorMetadata = {
  id: 'cs_sma',
  name: 'C# SMA',
  description: 'Simple moving average compiled from C# to WebAssembly',
  overlay: true,
  params: [{ name: 'period', label: 'Period', type: 'number', default: 20, min: 1, max: 500, step: 1 }],
};

/** A compact C# indicator source following the wrapper WASM ABI. */
export const csSampleSource = `using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json.Nodes;

public static class Indicator
{
    private static byte[]? _result;

    [UnmanagedCallersOnly(EntryPoint = "alloc")]
    public static IntPtr Alloc(int length) => Marshal.AllocHGlobal(length);

    [UnmanagedCallersOnly(EntryPoint = "free")]
    public static void Free(IntPtr ptr, int length) { if (ptr != IntPtr.Zero) Marshal.FreeHGlobal(ptr); }

    [UnmanagedCallersOnly(EntryPoint = "result_len")]
    public static int ResultLen() => _result?.Length ?? 0;

    [UnmanagedCallersOnly(EntryPoint = "compute")]
    public static IntPtr Compute(IntPtr inputPtr, int inputLength)
    {
        var bytes = new byte[inputLength];
        Marshal.Copy(inputPtr, bytes, 0, inputLength);
        var input = JsonNode.Parse(Encoding.UTF8.GetString(bytes))!.AsObject();
        var period = input["params"]?["period"]?.GetValue<int>() ?? 20;
        var candles = input["candles"]!.AsArray();

        var plot = new JsonArray();
        double sum = 0; int i = 0;
        foreach (var candle in candles)
        {
            var close = candle!["close"]!.GetValue<double>();
            sum += close;
            if (i >= period) sum -= candles[i - period]!["close"]!.GetValue<double>();
            if (i >= period - 1)
                plot.Add(new JsonObject { ["time"] = candle["time"]!.GetValue<long>(), ["value"] = sum / period });
            i++;
        }

        var result = new JsonObject
        {
            ["plots"] = new JsonArray
            {
                new JsonObject { ["id"] = "sma", ["type"] = "line", ["data"] = plot }
            }
        };
        _result = Encoding.UTF8.GetBytes(result.ToJsonString());
        var ptr = Marshal.AllocHGlobal(_result.Length);
        Marshal.Copy(_result, 0, ptr, _result.Length);
        return ptr;
    }
}
`;
