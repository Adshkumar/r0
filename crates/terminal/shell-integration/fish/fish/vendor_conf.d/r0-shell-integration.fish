# R0 shell integration for fish: emits OSC 133 prompt and command marks
# plus OSC 7 working directory reports so the terminal can track commands.
if status is-interactive; and set -q R0_SHELL_INTEGRATION; and not set -q R0_SHELL_INTEGRATION_LOADED
    set -g R0_SHELL_INTEGRATION_LOADED 1

    function __r0_osc
        printf '\e]%s\a' $argv[1]
    end

    function __r0_precmd --on-event fish_prompt
        set -l exit_code $status
        if set -q __r0_command_running
            __r0_osc "133;D;$exit_code"
            set -e __r0_command_running
        end
        __r0_osc "7;file://$hostname$PWD"
        __r0_osc "133;A"
    end

    function __r0_preexec --on-event fish_preexec
        set -g __r0_command_running 1
        __r0_osc "133;C"
    end

    if functions -q fish_prompt; and not functions -q __r0_user_fish_prompt
        functions -c fish_prompt __r0_user_fish_prompt
        function fish_prompt
            __r0_user_fish_prompt
            __r0_osc "133;B"
        end
    end
end
