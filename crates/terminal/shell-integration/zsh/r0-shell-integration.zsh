# R0 shell integration for zsh: emits OSC 133 prompt and command marks
# plus OSC 7 working directory reports so the terminal can track commands.
if [[ -n "${R0_SHELL_INTEGRATION_LOADED-}" || -z "${R0_SHELL_INTEGRATION-}" ]]; then
  return
fi
R0_SHELL_INTEGRATION_LOADED=1

__r0_osc() {
  builtin printf '\e]%s\a' "$1"
}

__r0_report_cwd() {
  __r0_osc "7;file://${HOST:-localhost}${PWD}"
}

__r0_precmd() {
  local exit_code=$?
  if [[ -n "${__r0_command_running-}" ]]; then
    __r0_osc "133;D;${exit_code}"
    __r0_command_running=""
  fi
  __r0_report_cwd
  __r0_osc "133;A"
}

__r0_preexec() {
  __r0_command_running=1
  __r0_osc "133;C"
}

autoload -Uz add-zsh-hook
add-zsh-hook precmd __r0_precmd
add-zsh-hook preexec __r0_preexec

if [[ "$PS1" != *'133;B'* ]]; then
  PS1="${PS1}"$'%{\e]133;B\a%}'
fi
