using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json.Nodes;

namespace CsIndicators;

/// <summary>
/// Sample C# indicator implementing an SMA overlay.
///
/// It follows the wrapper's WASM ABI:
///   alloc(i32) -> i32
///   free(i32, i32) -> void
///   compute(i32 inputPtr, i32 inputLength) -> i32 (result pointer)
///   result_len() -> i32
///
/// The input payload is UTF-8 JSON: { "candles": [...], "params": { "period": 20 } }
/// and the result is a UTF-8 JSON IndicatorResult: { "plots": [...] }.
/// </summary>
public static class Indicator
{
    private static byte[]? _result;

    [UnmanagedCallersOnly(EntryPoint = "alloc")]
    public static IntPtr Alloc(int length) => Marshal.AllocHGlobal(length);

    [UnmanagedCallersOnly(EntryPoint = "free")]
    public static void Free(IntPtr ptr, int length)
    {
        if (ptr != IntPtr.Zero) Marshal.FreeHGlobal(ptr);
    }

    [UnmanagedCallersOnly(EntryPoint = "result_len")]
    public static int ResultLen() => _result?.Length ?? 0;

    [UnmanagedCallersOnly(EntryPoint = "compute")]
    public static IntPtr Compute(IntPtr inputPtr, int inputLength)
    {
        var inputBytes = new byte[inputLength];
        Marshal.Copy(inputPtr, inputBytes, 0, inputLength);
        var input = JsonNode.Parse(Encoding.UTF8.GetString(inputBytes))!.AsObject();

        var period = input["params"]?["period"]?.GetValue<int>() ?? 20;
        var candles = input["candles"]!.AsArray();

        var times = new List<long>();
        var closes = new List<double>();
        foreach (var candle in candles)
        {
            times.Add(candle!["time"]!.GetValue<long>());
            closes.Add(candle["close"]!.GetValue<double>());
        }

        var plot = new JsonArray();
        double sum = 0;
        for (int i = 0; i < closes.Count; i++)
        {
            sum += closes[i];
            if (i >= period) sum -= closes[i - period];
            if (i >= period - 1)
            {
                plot.Add(new JsonObject
                {
                    ["time"] = times[i],
                    ["value"] = Math.Round(sum / period, 4),
                });
            }
        }

        var result = new JsonObject
        {
            ["plots"] = new JsonArray
            {
                new JsonObject
                {
                    ["id"] = "sma",
                    ["type"] = "line",
                    ["data"] = plot,
                    ["options"] = new JsonObject { ["color"] = "#26a69a", ["lineWidth"] = 2 },
                },
            },
        };

        _result = Encoding.UTF8.GetBytes(result.ToJsonString());
        var resultPtr = Marshal.AllocHGlobal(_result.Length);
        Marshal.Copy(_result, 0, resultPtr, _result.Length);
        return resultPtr;
    }
}
