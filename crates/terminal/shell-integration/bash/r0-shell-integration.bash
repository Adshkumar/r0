# R0 shell integration for bash. Loaded through --init-file, so it first
# runs the files an interactive shell would have read on its own, then emits
# OSC 133 prompt and command marks plus OSC 7 working directory reports.
#
# R0_SHELL_LOGIN is set when the shell would normally have been a login
# shell (Git Bash on Windows). A login shell reads the profile files and
# leaves ~/.bashrc to them, so mirror that instead of reading ~/.bashrc twice.
if [[ -n "${R0_SHELL_LOGIN-}" ]]; then
  unset R0_SHELL_LOGIN
  if [[ -r /etc/profile ]]; then
    source /etc/profile
  fi
  for __r0_profile in "$HOME/.bash_profile" "$HOME/.bash_login" "$HOME/.profile"; do
    if [[ -r "$__r0_profile" ]]; then
      source "$__r0_profile"
      break
    fi
  done
  unset __r0_profile
else
  if [[ -r /etc/bash.bashrc ]]; then
    source /etc/bash.bashrc
  fi
  if [[ -r "$HOME/.bashrc" ]]; then
    source "$HOME/.bashrc"
  fi
fi

if [[ -n "${R0_SHELL_INTEGRATION_LOADED-}" || -z "${R0_SHELL_INTEGRATION-}" ]]; then
  return 0 2>/dev/null
fi
R0_SHELL_INTEGRATION_LOADED=1

__r0_osc() {
  builtin printf '\e]%s\a' "$1"
}

__r0_precmd() {
  local exit_code=$?
  if [[ -n "${__r0_command_running-}" ]]; then
    __r0_osc "133;D;${exit_code}"
    __r0_command_running=""
  fi
  __r0_osc "7;file://${HOSTNAME:-localhost}${PWD}"
  __r0_osc "133;A"
}

__r0_interactive_mode() {
  __r0_interactive=1
}

__r0_preexec() {
  if [[ -n "${COMP_LINE-}" || -z "${__r0_interactive-}" || "$BASH_SUBSHELL" != "0" ]]; then
    return
  fi
  __r0_interactive=""
  __r0_command_running=1
  __r0_osc "133;C"
}

if [[ "$(declare -p PROMPT_COMMAND 2>/dev/null)" == "declare -a"* ]]; then
  PROMPT_COMMAND=(__r0_precmd "${PROMPT_COMMAND[@]}" __r0_interactive_mode)
else
  PROMPT_COMMAND="__r0_precmd${PROMPT_COMMAND:+;$PROMPT_COMMAND};__r0_interactive_mode"
fi
trap '__r0_preexec' DEBUG

if [[ "$PS1" != *'133;B'* ]]; then
  PS1="${PS1}\[\e]133;B\a\]"
fi
