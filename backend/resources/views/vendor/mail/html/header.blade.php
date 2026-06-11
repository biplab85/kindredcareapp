@props(['url'])
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block;">
<img
    src="{{ rtrim(config('app.frontend_url'), '/') }}/logo.png"
    alt="{{ config('app.name') }}"
    width="162"
    height="36"
    style="max-width: 180px; height: auto; display: inline-block; border: 0;"
    class="logo"
>
</a>
</td>
</tr>
