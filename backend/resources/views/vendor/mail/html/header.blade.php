@props(['url'])
{{--
    Don't put class="logo" on the <img> — Laravel's CssToInlineStyles
    pass would inline the framework's `.logo { width: 75px; height: 75px }`
    rule, squishing the wide KindredCare wordmark into a tiny square. With
    no matching class, the explicit width/height attributes and the inline
    style here win on every major email client.
--}}
<tr>
<td class="header">
<a href="{{ $url }}" style="display: inline-block;">
<img
    src="{{ rtrim(config('app.frontend_url'), '/') }}/logo.png"
    alt="{{ config('app.name') }}"
    width="200"
    height="44"
    style="width: 200px; height: auto; max-width: 80%; margin-top: 15px; margin-bottom: 10px; display: inline-block; border: 0;"
>
</a>
</td>
</tr>
