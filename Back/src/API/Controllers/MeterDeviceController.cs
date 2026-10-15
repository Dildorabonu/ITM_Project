using System.Net.Sockets;
using API.Authorization;
using API.Services;
using Application.DTOs;
using Application.DTOs.Energy;
using Application.Helpers;
using Application.Options;
using Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NModbus;

namespace API.Controllers;

/// <summary>
/// Hisoblagich qurilmalari (IP, port, Slave ID). IP manzillar ichki tarmoq
/// ma'lumoti — o'qish ham, o'zgartirish ham faqat "Energy.Update" ruxsati bilan.
/// </summary>
[ApiController]
[Route("api/meter-devices")]
[Authorize]
public class MeterDeviceController : ControllerBase
{
    private readonly IMeterDeviceService _service;

    public MeterDeviceController(IMeterDeviceService service)
    {
        _service = service;
    }

    [HasPermission("Energy.Update")]
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var result = await _service.GetAllAsync();
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("Energy.Update")]
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] MeterDeviceSaveDto dto)
    {
        var result = await _service.CreateAsync(dto);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("Energy.Update")]
    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] MeterDeviceSaveDto dto)
    {
        var result = await _service.UpdateAsync(id, dto);
        return StatusCode(result.StatusCode, result);
    }

    [HasPermission("Energy.Update")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var result = await _service.DeleteAsync(id);
        return StatusCode(result.StatusCode, result);
    }

    /// <summary>Kiritilgan sozlama bilan qurilmaga ulanib, bir marta o'qiydi. Hech narsa saqlanmaydi.</summary>
    [HasPermission("Energy.Update")]
    [HttpPost("test")]
    public async Task<IActionResult> Test([FromBody] MeterDeviceSaveDto dto, CancellationToken cancellationToken)
    {
        ApiResult<MeterDeviceTestResultDto> result;

        var validation = MeterDeviceValidator.ValidateConnection(dto);
        if (validation is not null)
        {
            result = ApiResult<MeterDeviceTestResultDto>.Failure([validation], 400);
            return StatusCode(result.StatusCode, result);
        }

        var device = new MeterDeviceOptions
        {
            Ip = dto.Ip.Trim(),
            Port = dto.Port,
            SlaveId = dto.SlaveId,
            StartAddress = dto.StartAddress,
            RegisterCount = dto.RegisterCount,
            PtRatio = dto.PtRatio,
        };

        try
        {
            var sample = await MeterModbusReader.ProbeAsync(device, cancellationToken);

            result = ApiResult<MeterDeviceTestResultDto>.Success(new MeterDeviceTestResultDto
            {
                Voltage = Math.Round(sample.Voltage, 1),
                Current = Math.Round(sample.Current, 2),
                Power = sample.Power,
                Frequency = Math.Round(sample.Frequency, 2),
            });
        }
        catch (Exception ex) when (!cancellationToken.IsCancellationRequested)
        {
            result = ApiResult<MeterDeviceTestResultDto>.Failure(
                [$"{device.Ip}:{device.Port} — {DescribeError(ex)}"], 400);
        }

        return StatusCode(result.StatusCode, result);
    }

    private static string DescribeError(Exception ex) => ex switch
    {
        OperationCanceledException or SocketException { SocketErrorCode: SocketError.TimedOut } =>
            "qurilma javob bermadi. IP manzil va tarmoq ulanishini tekshiring.",
        SocketException { SocketErrorCode: SocketError.ConnectionRefused } =>
            "ulanish rad etildi. Port yopiq yoki qurilma Modbus TCP'ni qo'llamaydi.",
        SocketException { SocketErrorCode: SocketError.HostUnreachable or SocketError.NetworkUnreachable } =>
            "manzil tarmoqda topilmadi.",
        SlaveException =>
            "qurilma so'rovni rad etdi. Slave ID va registr manzilini tekshiring.",
        // TCP ochilib javob kelmasa, odatda Ethernet→RS485 gateway ishlayapti-yu,
        // uning ortidagi hisoblagich javob bermayapti — sabab faqat Slave ID emas.
        IOException or TimeoutException =>
            "ulanish ochildi, lekin hisoblagich javob bermadi. Hisoblagich yoqilganini, RS485 ulanishini va Slave ID ni tekshiring.",
        _ => ex.Message,
    };
}
