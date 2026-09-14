#!/bin/bash
# -----------------------------------------------------------------------------------------------------------
# Copyright (c) 2026 Huawei Technologies Co., Ltd.
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
# -----------------------------------------------------------------------------------------------------------

set -e
set -o pipefail

echo "ut_type=${ut_type:-}"
echo "TARGET_BRANCH=${TARGET_BRANCH:-}"
echo "ge_st_rt2=${ge_st_rt2:-}"
echo "task_name=${task_name:-}"

grep -E "^VERSION_ID=" /etc/os-release | cut -d'"' -f2
export PATH=/opt/buildtools/python-3.10.2/bin:$PATH
if [ "${GIT_TARGET_BRANCH}" == "master" ]; then
    sudo update-alternatives --set gcc /usr/bin/gcc-15
else
    sudo update-alternatives --set gcc /usr/bin/gcc-14
fi
if gcc --version | head -n1 | grep -q "15\."; then
    rm -rf /home/jenkins/opensource/lib_cache
    if [ -d /home/jenkins/opensource/gcc15 ]; then
        rm -rf /home/jenkins/opensource/gcc15/lib_cache/abseil-cpp
        rm -rf /home/jenkins/opensource/gcc15/lib_cache/device/abseil-cpp
        ln -s /home/jenkins/opensource/gcc15/lib_cache/ /home/jenkins/opensource/lib_cache
    elif [ -d /home/jenkins/opensource/gcc15x86 ]; then
        rm -rf /home/jenkins/opensource/gcc15x86/lib_cache/abseil-cpp
        rm -rf /home/jenkins/opensource/gcc15x86/lib_cache/device/abseil-cpp
        ln -s /home/jenkins/opensource/gcc15x86/lib_cache/ /home/jenkins/opensource/lib_cache
    fi
elif gcc --version | head -n1 | grep -q "14\."; then
    gcc --version
else
    gcc --version
    rm -rf /home/jenkins/opensource/lib_cache
    ln -s /home/jenkins/opensource/ubuntu20/lib_cache /home/jenkins/opensource/lib_cache
fi
gcc --version

# Print and execute a command, capturing its exit code in the global variable ${ret}
function LOG_DO() {
    local date_time
    date_time=$(date +%Y%m%d-%H%M%S)
    echo -e "[Command] ${date_time} $*"
    "$@" && ret=0 || ret=$?
    return "${ret}"
}

function DP_ASSERT_EQUAL() {
    local actual_value=${1}
    local expect_value=${2}
    local assert_msg=${3}
    echo "actual_value:${actual_value}"
    echo "expect_value:${expect_value}"
    if [ "${actual_value}" != "${expect_value}" ]; then
        echo "${assert_msg} is failed."
        exit 1
    else
        echo "${assert_msg} is success."
    fi
}

main() {
    cd "${WORKSPACE}" || exit
    source /home/jenkins/Ascend/cann/bin/setenv.bash
    echo "Start run c++ testcase"
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
    npm install --save-dev vitest
    # Only run UT tests on the master branch
    if [[ "${TARGET_BRANCH}" != "master" ]]; then
        echo "Skip UT test on non-master branch"
        exit 0
    fi
    set +e
    LOG_DO npx vitest run test/ut --coverage
    DP_ASSERT_EQUAL "$?" "0" "Run UT TESTCASE"
    echo "Run UT TESTCASE success"
    echo "ut_process=ut_cov" >> $ATOMGIT_OUTPUT
}

main "$@"
